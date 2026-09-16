import IndicatorPageClient from "./IndicatorPageClient";
import { INDICATORS } from "@/lib/metrics";

export function generateStaticParams() {
  return INDICATORS.map((item) => ({ id: item.id }));
}

export default function IndicatorPage() {
  return <IndicatorPageClient />;
}
