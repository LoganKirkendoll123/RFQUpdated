import React from 'react';
import { 
  Zap, 
  Download, 
  Share2, 
  Copy, 
  Mail, 
  FileText,
  Calculator,
  TrendingUp,
  Users,
  Settings
} from 'lucide-react';
import { ProcessingResult } from '../types';

interface QuickActionsProps {
  results: ProcessingResult[];
  onExportCustomerView: () => void;
  onExportAnalytics: () => void;
  onShareQuotes: () => void;
  onCalculateMargins: () => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  results,
  onExportCustomerView,
  onExportAnalytics,
  onShareQuotes,
  onCalculateMargins
}) => {
  const hasResults = results.length > 0;
  const successfulResults = results.filter(r => r.status === 'success' && r.quotes.length > 0);

  const actions = [
    {
      id: 'customer-view',
      label: 'Customer Quote View',
      description: 'Generate clean customer-facing quotes',
      icon: Users,
      action: onExportCustomerView,
      enabled: hasResults,
      color: 'blue'
    },
    {
      id: 'export-analytics',
      label: 'Export Analytics',
      description: 'Download detailed performance report',
      icon: TrendingUp,
      action: onExportAnalytics,
      enabled: hasResults,
      color: 'green'
    },
    {
      id: 'share-quotes',
      label: 'Share Quotes',
      description: 'Send quotes via email or link',
      icon: Share2,
      action: onShareQuotes,
      enabled: hasResults,
      color: 'purple'
    },
    {
      id: 'calculate-margins',
      label: 'Margin Calculator',
      description: 'Analyze profit margins and pricing',
      icon: Calculator,
      action: onCalculateMargins,
      enabled: hasResults,
      color: 'orange'
    }
  ];

  const copyBestQuotes = async () => {
    if (successfulResults.length === 0) return;

    const bestQuotes = successfulResults.map(result => {
      const bestQuote = result.quotes.reduce((best, current) => 
        (current as any).customerPrice < (best as any).customerPrice ? current : best
      );
      return {
        route: `${result.originalData.fromZip} → ${result.originalData.toZip}`,
        carrier: bestQuote.carrier.name,
        price: (bestQuote as any).customerPrice,
        transit: bestQuote.transitDays
      };
    });

    const text = bestQuotes.map(q => 
      `${q.route}: ${q.carrier} - $${q.price} (${q.transit || 'N/A'} days)`
    ).join('\n');

    try {
      await navigator.clipboard.writeText(text);
      // Could add a toast notification here
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Zap className="h-5 w-5 text-orange-500" />
        <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={action.action}
              disabled={!action.enabled}
              className={`p-4 rounded-lg border-2 border-dashed transition-all duration-200 text-left ${
                action.enabled
                  ? `border-${action.color}-300 hover:border-${action.color}-500 hover:bg-${action.color}-50`
                  : 'border-gray-200 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center space-x-3 mb-2">
                <Icon className={`h-5 w-5 ${
                  action.enabled ? `text-${action.color}-600` : 'text-gray-400'
                }`} />
                <span className={`font-medium ${
                  action.enabled ? 'text-gray-900' : 'text-gray-500'
                }`}>
                  {action.label}
                </span>
              </div>
              <p className={`text-sm ${
                action.enabled ? 'text-gray-600' : 'text-gray-400'
              }`}>
                {action.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Additional Quick Actions */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={copyBestQuotes}
            disabled={successfulResults.length === 0}
            className="inline-flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Copy className="h-4 w-4" />
            <span>Copy Best Quotes</span>
          </button>

          <button
            disabled={!hasResults}
            className="inline-flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Mail className="h-4 w-4" />
            <span>Email Summary</span>
          </button>

          <button
            disabled={!hasResults}
            className="inline-flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText className="h-4 w-4" />
            <span>Generate Report</span>
          </button>
        </div>
      </div>
    </div>
  );
};