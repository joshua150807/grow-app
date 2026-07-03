import AdminProtectedRoute from '../../features/admin/components/AdminProtectedRoute';
import AdminVideoAnalyticsScreen from '../../features/admin/screens/AdminVideoAnalyticsScreen';

export default function AdminVideoAnalyticsRoute() {
  return (
    <AdminProtectedRoute>
      <AdminVideoAnalyticsScreen />
    </AdminProtectedRoute>
  );
}
