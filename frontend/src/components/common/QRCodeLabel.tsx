import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../ui/button';
import { Printer } from 'lucide-react';

interface QRCodeLabelProps {
    value: string; // The URL or ID to encode
    label: string; // Text to show on the label (e.g. Code of equipment)
    subLabel?: string; // Secondary text (e.g. Serial number)
    type?: 'equipment' | 'work-order';
}

export const QRCodeLabel: React.FC<QRCodeLabelProps> = ({ value, label, subLabel, type = 'equipment' }) => {
    const printRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        const printContent = printRef.current;
        const windowUrl = 'about:blank';
        const uniqueName = new Date().getTime();
        const windowName = 'Print' + uniqueName;
        const printWindow = window.open(windowUrl, windowName, 'left=50000,top=50000,width=0,height=0');

        if (printWindow && printContent) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Etiqueta QR Code - ${label}</title>
                        <style>
                            @page { size: 50mm 30mm; margin: 0; }
                            body { 
                                width: 50mm; 
                                height: 30mm; 
                                margin: 0; 
                                padding: 2mm; 
                                font-family: sans-serif; 
                                display: flex; 
                                flex-direction: row; 
                                align-items: center; 
                                justify-content: center;
                                box-sizing: border-box;
                            }
                            .qr-container { width: 25mm; height: 25mm; }
                            .text-container { 
                                flex: 1; 
                                padding-left: 2mm; 
                                display: flex; 
                                flex-direction: column; 
                                justify-content: center; 
                                overflow: hidden;
                            }
                            .label { font-size: 10pt; font-weight: bold; margin-bottom: 2pt; }
                            .sublabel { font-size: 8pt; color: #666; }
                            .type { font-size: 6pt; text-transform: uppercase; color: #999; margin-top: 4pt; }
                        </style>
                    </head>
                    <body>
                        ${printContent.innerHTML}
                        <script>
                            window.onload = function() {
                                window.print();
                                window.close();
                            }
                        </script>
                    </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.focus();
        }
    };

    return (
        <div className="flex flex-col items-center gap-4 p-4 border rounded-xl bg-surface-50">
            <div ref={printRef} className="hidden print:flex bg-white flex-row items-center justify-center p-1 border">
                <div className="qr-container">
                    <QRCodeSVG
                        value={value}
                        size={80} // Approx 22mm
                        level="H"
                        includeMargin={false}
                    />
                </div>
                <div className="text-container">
                    <div className="label">{label}</div>
                    {subLabel && <div className="sublabel">{subLabel}</div>}
                    <div className="type">{type === 'equipment' ? 'Equipamento' : 'Ordem de Serviço'}</div>
                </div>
            </div>

            <div className="bg-surface-0 p-6 shadow-sm rounded-lg flex flex-col items-center gap-2 border">
                <QRCodeSVG value={value} size={150} />
                <div className="text-center mt-2">
                    <p className="font-bold text-lg">{label}</p>
                    {subLabel && <p className="text-sm text-surface-500">{subLabel}</p>}
                </div>
            </div>

            <Button onClick={handlePrint} className="gap-2 w-full">
                <Printer size={18} /> Imprimir Etiqueta
            </Button>
        </div>
    );
};
