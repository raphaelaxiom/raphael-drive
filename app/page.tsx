"use client";
import dynamic from "next/dynamic";
const RaphaelDrive = dynamic(() => import("@/components/RaphaelDrive"), { ssr: false });
export default function Page() {
  return <RaphaelDrive />;
}
