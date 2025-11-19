"use client";

import { useState } from "react";

interface DangerousConfirmModalProps {
    isOpen: boolean;
    title: string;
    description: string;
    confirmKeyword?: string; // Palabra que el usuario debe escribir (ej: "ELIMINAR")
    onClose: () => void;
    onConfirm: () => void;
}

export default function DangerousConfirmModal({
    isOpen,
    title,
    description,
    confirmKeyword = "CONFIRMAR",
    onClose,
    onConfirm,
}: DangerousConfirmModalProps) {
    const [step, setStep] = useState<1 | 2>(1);
    const [input, setInput] = useState("");

    if (!isOpen) return null;

    const handleConfirmStep1 = () => {
        setStep(2);
    };

    const handleFinalConfirm = () => {
        if (input.toUpperCase() !== confirmKeyword) return;
        onConfirm();
        reset();
    };

    const reset = () => {
        setStep(1);
        setInput("");
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-red-100">

                {/* Cabecera de Alerta */}
                <div className="bg-red-50 p-4 border-b border-red-100 flex items-center gap-3">
                    <div className="bg-red-100 p-2 rounded-full text-red-600">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    </div>
                    <h3 className="text-lg font-bold text-red-900">Zona de Peligro</h3>
                </div>

                <div className="p-6">
                    <h4 className="text-xl font-semibold mb-2">{title}</h4>
                    <p className="text-gray-600 text-sm mb-6">{description}</p>

                    {step === 1 ? (
                        <div className="flex gap-3 justify-end">
                            <button onClick={reset} className="btn btn-outline text-sm">Cancelar</button>
                            <button onClick={handleConfirmStep1} className="btn bg-red-600 text-white hover:bg-red-700 border-none">
                                Entiendo el riesgo, continuar
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                            <div className="bg-red-50 border border-red-200 p-3 rounded text-sm text-red-800">
                                Esta acción <strong>NO SE PUEDE DESHACER</strong>.
                                <br />
                                Escribe <strong>{confirmKeyword}</strong> abajo para confirmar.
                            </div>
                            <input
                                type="text"
                                className="input border-red-300 focus:ring-red-500 focus:border-red-500"
                                placeholder={`Escribe ${confirmKeyword}`}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                autoFocus
                            />
                            <div className="flex gap-3 justify-end pt-2">
                                <button onClick={reset} className="btn btn-outline text-sm">Cancelar</button>
                                <button
                                    onClick={handleFinalConfirm}
                                    disabled={input.toUpperCase() !== confirmKeyword}
                                    className="btn bg-red-600 text-white hover:bg-red-700 border-none disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Eliminar Definitivamente
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}