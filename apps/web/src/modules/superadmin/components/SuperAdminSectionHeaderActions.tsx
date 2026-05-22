"use client";

import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
    children: ReactNode;
};

export function SuperAdminSectionHeaderActions({ children }: Props) {
    const [target, setTarget] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setTarget(document.getElementById("superadmin-section-actions"));
    }, []);

    if (!target) return null;

    return createPortal(children, target);
}
