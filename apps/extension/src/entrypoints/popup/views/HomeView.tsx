import { Card, ListItem, SectionHeader } from '@sidekick/ui-kit';
import { categoryLabels, featuresByCategory } from '../../../features/registry';
import type { FeatureManifest } from '../../../lib/feature';

interface Props {
  onSelect: (featureId: string) => void;
}

const CATEGORY_ORDER: FeatureManifest['category'][] = [
  'automation',
  'productivity',
  'developer',
  'privacy',
  'lifestyle',
];

export function HomeView({ onSelect }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {CATEGORY_ORDER.map((category) => {
        const items = featuresByCategory[category];
        if (!items || items.length === 0) return null;
        return (
          <div key={category}>
            <SectionHeader title={categoryLabels[category]} />
            <Card>
              <div className="divide-border divide-y">
                {items.map((feature) => {
                  const Icon = feature.icon;
                  const Summary = feature.Summary;
                  return (
                    <ListItem
                      key={feature.id}
                      icon={<Icon className="h-4 w-4" />}
                      iconTone={feature.iconTone}
                      title={feature.name}
                      description={feature.description}
                      trailing={Summary ? <Summary /> : undefined}
                      showChevron
                      interactive
                      onClick={() => onSelect(feature.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelect(feature.id);
                        }
                      }}
                      className="!rounded-none first:!rounded-t-lg last:!rounded-b-lg"
                    />
                  );
                })}
              </div>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
