import { useLocalSearchParams } from 'expo-router';
import { AdminFeaturePage } from '../src/AdminFeaturePage';

export default function FeatureRoute() {
  const { feature } = useLocalSearchParams<{ feature?: string }>();
  return <AdminFeaturePage route={feature ?? ''} />;
}
