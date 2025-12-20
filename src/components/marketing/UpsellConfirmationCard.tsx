import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Sparkles } from 'lucide-react';

interface UpsellConfirmationCardProps {
  campaign: {
    linked_service: {
      name: string;
    };
    extra_price: number;
  };
  mainServiceName: string;
}

export function UpsellConfirmationCard({ campaign, mainServiceName }: UpsellConfirmationCardProps) {
  return (
    <Card className="border-2 border-primary/30 bg-gradient-to-br from-[#FDF2F8] to-[#FCE7F3] shadow-lg w-full lg:w-[300px]">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <div className="p-1.5 rounded-full bg-gradient-to-r from-[#9333EA] to-[#F472B6] text-white flex-shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-gray-800 mb-1">
              Parabéns! Você garantiu o combo promocional 🎉
            </h3>
            <div className="text-xs text-gray-600 space-y-1">
              <p className="font-medium text-gray-700">{mainServiceName}</p>
              <p className="flex items-center gap-1">
                <span>+</span>
                <span className="text-primary font-medium">{campaign.linked_service.name}</span>
              </p>
              <p className="text-primary font-semibold mt-1">
                + R$ {campaign.extra_price.toFixed(2).replace('.', ',')}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 rounded px-2 py-1">
          <CheckCircle className="h-3 w-3" />
          <span className="font-medium">Promoção ativa</span>
        </div>
      </CardContent>
    </Card>
  );
}

