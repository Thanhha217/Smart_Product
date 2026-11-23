"""Generate the AI illustrations of the CO2 world with the OpenAI Images API.

One consistent style for every scene of the journey (mine, factory, ports, ship, plane,
truck, home, coal plant, solar, recycling, WEFE city). The pictures carry NO text and NO
numbers: the web page draws the real figures and the flow on top of them.

    # print the plan and the cost estimate, spend nothing
    python scripts/demo/generate_illustrations.py
    # generate (needs OPENAI_API_KEY in the environment or in the root .env)
    python scripts/demo/generate_illustrations.py --yes [--quality medium] [--only factory,ship]

Output: frontend/public/illustrations/<scene>.<ext> + manifest.json (read by /world).
Requires: pip install openai
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "public" / "illustrations"
MODELS = [m for m in [os.environ.get("OPENAI_IMAGE_MODEL"), "gpt-image-2.5", "gpt-image-1.5", "gpt-image-1-mini", "gpt-image-1"] if m]
SIZE = "1536x1024"
# Approximate USD per 1536x1024 image (third-party price summaries, Nov 2026; check OpenAI's pricing page).
PRICE = {"low": 0.015, "medium": 0.05, "high": 0.20}

STYLE = ("Soft modern flat illustration with gentle gradients and subtle grain, cheerful educational style for an "
         "environmental explainer, warm daylight, pastel sky blue, leaf green, sand and teal palette with small warm "
         "orange accents, clean shapes, slight isometric three-quarter view, lots of breathing room, no text, no letters, "
         "no numbers, no logos, no watermark, no people's faces in close-up.")

SCENES = {
    "mine": "An open-pit mine in green hills with terraced rock layers, a small excavator and dump truck, glints of copper, "
            "lithium and rare-earth ore, a conveyor belt leading out of the frame to the right.",
    "factory": "A modern electronics factory complex with sawtooth roofs, two chimneys releasing soft grey smoke, a glass "
               "assembly hall where robotic arms assemble laptops, monitors and phones on a conveyor line.",
    "port_origin": "A busy Asian container port at sunrise with tall gantry cranes loading colourful shipping containers "
                   "onto a large container ship, stacked containers on the quay.",
    "ship": "A large container ship sailing across a calm turquoise sea, a long gentle wake behind it, a few seabirds, "
            "distant islands on the horizon.",
    "plane": "A cargo airplane climbing through soft clouds above the sea, seen from the side, contrails behind it.",
    "port_vn": "A Vietnamese seaport with cranes and containers, coconut palms, a delivery truck leaving the port gate "
               "onto a coastal road towards a city.",
    "truck": "A small delivery truck driving on a winding road through Vietnamese rice fields and a village, motorbikes, "
             "towards a modern city skyline in the distance.",
    "home": "A cosy Vietnamese tube house cut-away view showing the living room with a computer monitor and laptop on a "
            "desk, an air conditioner on the wall, a fridge, a power socket and a cable glowing softly, plants on the balcony.",
    "coal_plant": "A coal-fired power plant beside a river with cooling towers and a tall chimney, power lines on pylons "
                  "carrying electricity towards a city, a slightly hazy sky.",
    "solar": "Rooftops of a Vietnamese neighbourhood covered with solar panels and a row of wind turbines on a hill, "
             "clean bright sky, power lines carrying clean energy.",
    "recycle": "An electronics recycling centre: sorting conveyor with old phones, laptops and circuit boards, bins for "
               "metals, glass and plastic, green circular arrows motif, workers in safety vests seen from afar.",
    "city_wefe": "A green smart city by a river: rice fields, a water treatment plant, solar roofs, trees and parks, an "
                 "electric bus, connected in harmony to show water, energy, food and ecosystems together.",
}


def load_key() -> str | None:
    if os.environ.get("OPENAI_API_KEY"):
        return os.environ["OPENAI_API_KEY"]
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("OPENAI_API_KEY="):
                value = line.split("=", 1)[1].strip().strip('"').strip("'")
                return value or None
    return None


def generate(client, prompt: str, quality: str) -> tuple[bytes, str, str]:
    last = None
    for model in MODELS:
        for fmt in ("webp", None):
            kwargs = {"model": model, "prompt": prompt, "size": SIZE, "quality": quality, "n": 1}
            if fmt:
                kwargs.update(output_format=fmt, output_compression=82)
            try:
                result = client.images.generate(**kwargs)
                return base64.b64decode(result.data[0].b64_json), fmt or "png", model
            except Exception as error:  # unknown model or unsupported option: try the next combination
                last = error
                text = str(error).lower()
                if "output_format" in text or "output_compression" in text:
                    continue
                break
    raise RuntimeError(f"No image model worked: {last}")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--yes", action="store_true", help="really call the API (costs money)")
    ap.add_argument("--quality", choices=sorted(PRICE), default="medium")
    ap.add_argument("--only", default="", help="comma-separated scene names")
    ap.add_argument("--force", action="store_true", help="regenerate scenes that already exist")
    args = ap.parse_args()

    names = [s for s in (args.only.split(",") if args.only else SCENES) if s in SCENES]
    manifest_path = OUT / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {"scenes": {}}
    todo = [s for s in names if args.force or s not in manifest.get("scenes", {})]
    print(f"{len(todo)} scene(s) to generate at {SIZE}, quality={args.quality}: {', '.join(todo) or '-'}")
    print(f"estimated cost ≈ ${len(todo) * PRICE[args.quality]:.2f} (approximate, check OpenAI pricing)")
    if not args.yes:
        print("dry run: add --yes to generate")
        return
    key = load_key()
    if not key:
        sys.exit("OPENAI_API_KEY is not set (environment or root .env)")
    from openai import OpenAI
    client = OpenAI(api_key=key, timeout=180, max_retries=1)
    OUT.mkdir(parents=True, exist_ok=True)
    for name in todo:
        data, ext, model = generate(client, f"{SCENES[name]} {STYLE}", args.quality)
        (OUT / f"{name}.{ext}").write_bytes(data)
        manifest.setdefault("scenes", {})[name] = f"{name}.{ext}"
        manifest["style"] = STYLE
        manifest["model"] = model
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"  {name}.{ext}  ({len(data) // 1024} KB, {model})", flush=True)
    print(f"done: {manifest_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
