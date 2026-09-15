import React from "react";

export default function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[24px] font-semibold leading-[34px] text-textmain">{title}</h1>
        {subtitle && <p className="text-[13px] text-textsub mt-0.5 leading-5">{subtitle}</p>}
      </div>
      {children ? <div className="min-w-0 flex-1 flex justify-end">{children}</div> : null}
    </div>
  );
}
