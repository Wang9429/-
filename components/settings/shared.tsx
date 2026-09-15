"use client";

import React from "react";
import { Button, Drawer, inputClass, inputErrorClass } from "@/components/ui";

export function fieldClass(error?: string) {
  return error ? inputErrorClass : inputClass;
}

export function ActionCell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  );
}

export function FormDrawer({
  open,
  onClose,
  title,
  width = "560px",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  width?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Drawer open={open} onClose={onClose} title={title} width={width} footer={footer}>
      <div className="h-full overflow-auto px-6 py-5">{children}</div>
    </Drawer>
  );
}

export function SaveBar({
  onSave,
  onCancel,
  saveLabel = "保存",
  disabled,
  extra,
}: {
  onSave: () => void;
  onCancel: () => void;
  saveLabel?: string;
  disabled?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="primary" onClick={onSave} disabled={disabled}>
        {saveLabel}
      </Button>
      <Button onClick={onCancel}>取消</Button>
      {extra}
    </div>
  );
}

export function denyTitle(allowed: boolean, action: string) {
  return allowed ? action : `当前身份不能${action}`;
}
