# API "chọn đâu hỏi đó" (`POST /api/explain`)

Qua gateway: `POST http://localhost:8000/api/explain` (assistant service).

```jsonc
// request
{"product_id": "55051", "topic": "factory", "question": null, "lang": "vi",
 "scenario": null}   // hoặc {"origin": "VN", "mode": "air", "grid": "solar", "years": 6, "refurbished": true, "total_kg": 412.3}

// response
{"topic": "factory", "title": "Nhà máy và nguyên liệu",
 "answer": "2–4 câu dễ hiểu, chỉ dùng số có trong facts",
 "bullets": ["…"],                 // 0–4 ý ngắn
 "follow_ups": ["Vì sao …?", "…"], // 2–3 câu hỏi gợi ý tiếp
 "facts": {…},                     // số thật đã dùng (kg, %, kWh, nguồn…)
 "model": "openai:<model>" | "anthropic:<model>" | "rule-based",
 "cached": false, "number_check_failures": 0}
```

`topic` ∈ `co2e_total, green_score, confidence, materials, factory, transport, use, grid, end_of_life,
formula, category, greener_alternative, wefe, what_if, insight, free` (`free` = câu hỏi tự do trong `question`;
`insight` = nhận định ngắn "vì sao nên chọn / cân nhắc" so với trung vị cùng loại, chặng nặng nhất, một việc giảm CO₂; trên trung vị thì nói thật và gợi ý món xanh hơn).
Có `question` thì AI trả lời câu đó trong ngữ cảnh `topic`.

Quy tắc: số nào trong câu trả lời không có trong `facts` (hoặc `scenario`) thì câu đó bị bỏ và tăng
`number_check_failures`. Không có khóa LLM → câu giải thích soạn sẵn (`model: "rule-based"`).
Câu trả lời được cache trong bộ nhớ theo (sản phẩm, topic, câu hỏi, kịch bản, ngôn ngữ).
Nhà cung cấp: `LLM_PROVIDER=openai|anthropic|auto` (auto: OpenAI nếu có `OPENAI_API_KEY`, rồi Anthropic, rồi rule-based).
