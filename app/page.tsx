"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/overview");
  }, [router]);
  return <p className="p-6 text-[13px] text-textsub">正在进入综合总览…</p>;
}
