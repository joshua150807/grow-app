import AdminProtectedRoute from '../../features/admin/components/AdminProtectedRoute';
import AdminToolAnalyticsDetailScreen from '../../features/admin/screens/AdminToolAnalyticsDetailScreen';

export default function AdminToolAnalyticsDetailRoute() {
  return (
    <AdminProtectedRoute>
      <AdminToolAnalyticsDetailScreen />
    </AdminProtectedRoute>
  );
}
