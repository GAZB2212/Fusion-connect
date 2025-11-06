import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import logoImage from "@assets/NEW logo 2_1761587557587.png";
import { Download, QrCode } from "lucide-react";

export default function AdminQR() {
  return (
    <div className="min-h-screen bg-[#0A0E17] geometric-pattern">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <img 
            src={logoImage} 
            alt="Fusion Logo" 
            className="h-16 mx-auto mb-6"
          />
          <h1 className="text-4xl md:text-5xl font-bold text-[#F8F4E3] font-serif mb-3">
            Admin: QR Code
          </h1>
          <p className="text-[#F8F4E3]/70 text-lg">
            Downloadable QR code for the launch page
          </p>
        </div>

        {/* QR Code Section */}
        <div className="max-w-xl mx-auto">
          <Card className="bg-[#0A0E17] border-primary/30">
            <CardContent className="p-8 text-center">
              <div className="mb-4">
                <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-3">
                  <QrCode className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-serif font-bold text-[#F8F4E3] mb-2">
                  Launch Page QR Code
                </h3>
                <p className="text-sm text-[#F8F4E3]/70 mb-2">
                  Fusion gold (#D4AF37) on navy background (#111422)
                </p>
                <p className="text-xs text-[#F8F4E3]/50">
                  Scans to: https://www.fusioncouples.com/launch
                </p>
              </div>

              <div className="bg-white p-4 rounded-lg inline-block mb-4">
                <img 
                  src="/api/generate-qr-code" 
                  alt="Fusion Launch QR Code" 
                  className="w-64 h-64"
                  data-testid="img-qr-code"
                />
              </div>

              <Button
                variant="default"
                className="w-full hover-elevate"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = '/api/generate-qr-code';
                  link.download = 'fusion-launch-qr.png';
                  link.click();
                }}
                data-testid="button-download-qr"
              >
                <Download className="mr-2 h-4 w-4" />
                Download QR Code
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-8">
          <p className="text-sm text-[#F8F4E3]/50">
            This page is for internal use only. The QR code includes your Fusion logo.
          </p>
        </div>
      </div>
    </div>
  );
}
