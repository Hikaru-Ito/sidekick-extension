import type { FeatureManifest } from '../../../lib/feature';

interface Props {
  feature: FeatureManifest;
}

export function FeatureView({ feature }: Props) {
  const Panel = feature.Panel;
  return (
    <div className="animate-fade-in-up">
      <Panel />
    </div>
  );
}
