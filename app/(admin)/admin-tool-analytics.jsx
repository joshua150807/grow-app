import AdminProtectedRoute from '../../features/admin/components/AdminProtectedRoute';
import AdminToolAnalyticsScreen from '../../features/admin/screens/AdminToolAnalyticsScreen';

export default function AdminToolAnalyticsRoute() {
  return (
    <AdminProtectedRoute>
      <AdminToolAnalyticsScreen />
    </AdminProtectedRoute>
  );
}
