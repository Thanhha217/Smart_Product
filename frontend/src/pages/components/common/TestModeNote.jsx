// Compact, always-visible reminder that the cart and orders are a test: nothing is paid.
import Icon from "../ui/Icon";
import { useShopText } from "../../../i18n/shop";

export default function TestModeNote() {
  const st = useShopText();
  return (
    <p role="note" className="flex items-center gap-2 self-start rounded-full border border-[#f3d9a4] bg-[#fff8eb] px-3 py-1.5 text-[14px] font-medium text-[#7c4a03]">
      <Icon name="info" size={16} />{st("checkout.noPayment")}
    </p>
  );
}
