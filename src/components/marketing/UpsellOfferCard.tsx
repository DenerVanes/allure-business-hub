import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, TrendingUp, X } from 'lucide-react';

interface UpsellOfferCardProps {
  campaign: {
    id: string;
    message: string;
    extra_price: number;
    linked_service: {
      name: string;
      price: number;
    };
  };
  mainServicePrice: number;
  onAccept: () => void;
  onDecline: () => void;
}

export function UpsellOfferCard({ campaign, mainServicePrice, onAccept, onDecline }: UpsellOfferCardProps) {
  const totalPrice = mainServicePrice + campaign.extra_price;

  return (
    <Card className="border-2 border-primary/30 bg-gradient-to-br from-[#FDF2F8] to-[#FCE7F3] shadow-lg">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-gradient-to-r from-[#9333EA] to-[#F472B6] text-white">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-gray-800 mb-2">
              Oferta Especial para Você! 💜
            </h3>
            <p className="text-gray-700 text-sm leading-relaxed mb-4">
              {campaign.message}
            </p>
          </div>
        </div>

        <div className="bg-white/60 rounded-lg p-4 space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Serviço Principal:</span>
            <span className="font-medium">R$ {mainServicePrice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">+ {campaign.linked_service.name}:</span>
            <span className="font-medium text-primary">+ R$ {campaign.extra_price.toFixed(2)}</span>
          </div>
          <div className="border-t border-gray-300 pt-2 flex justify-between items-center">
            <span className="font-semibold text-gray-800">Total:</span>
            <span className="font-bold text-lg text-primary">R$ {totalPrice.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={onAccept}
            className="flex-1 bg-gradient-to-r from-[#9333EA] to-[#F472B6] hover:from-[#7C2D9A] hover:to-[#DB2777] text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200"
          >
            Aceitar Oferta
          </Button>
          <Button
            onClick={onDecline}
            variant="outline"
            className="flex-1 border-gray-300 hover:bg-gray-50 text-gray-700"
          >
            Agora Não
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

