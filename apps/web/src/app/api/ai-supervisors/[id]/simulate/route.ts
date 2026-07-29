import { NextResponse } from "next/server";

export async function POST() {
    return NextResponse.json({ message: "Módulo de supervisores de IA removido do IOAuto." }, { status: 410 });
}
