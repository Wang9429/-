import ObjectPageClient from "./ObjectPageClient";
import { allObjectIds } from "@/lib/objects";

export function generateStaticParams() {
  return allObjectIds().map((id) => ({ id }));
}

export default function ObjectPage() {
  return <ObjectPageClient />;
}
