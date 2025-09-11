"use client";
import Link from "next/link";

export default function TabsNav({active}:{active:"rk"|"groups"|"archive"}){
  const pill = (href:string, text:string, isActive:boolean) => (
    <Link
      href={href}
      className={
        "inline-flex items-center rounded-full border px-4 py-2 text-sm "+
        (isActive ? "bg-sky-600 text-white border-sky-600" : "border-sky-500 text-sky-700 hover:bg-sky-50")
      }>
      {text}
    </Link>
  );
  return (
    <nav className="mb-4 flex gap-3">
      {pill("/campaigns","РК", active==="rk")}
      {pill("/campaigns/groups","Группы", active==="groups")}
      {pill("/campaigns/archive","Архив", active==="archive")}
    </nav>
  );
}
