import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  description?: string;
  action?: ReactNode;
}

export const MetricCard = ({ 
  title, 
  value, 
  change, 
  changeType = 'neutral', 
  icon: Icon, 
  description,
  action
}: MetricCardProps) => {
  const getChangeColor = () => {
    switch (changeType) {
      case 'positive':
        return 'text-success';
      case 'negative':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <Card 
      className="group hover:shadow-md transition-all duration-300 border-0"
      style={{ borderRadius: '20px' }}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium" style={{ color: '#5A4A5E' }}>
          {title}
        </CardTitle>
        <div 
          className="p-2 rounded-lg transition-colors duration-200"
          style={{ 
            backgroundColor: '#F7D5E8',
            color: '#8E44EC'
          }}
        >
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-3xl font-bold" style={{ color: '#5A2E98' }}>
            {value}
          </div>
          {(change || description) && (
            <div className="flex items-center justify-between">
              {change && (
                <p className={`text-xs ${getChangeColor()}`}>
                  {change}
                </p>
              )}
              {description && (
                <p className="text-xs" style={{ color: '#5A4A5E' }}>
                  {description}
                </p>
              )}
            </div>
          )}
          {action && (
            <div className="mt-3">
              {action}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};