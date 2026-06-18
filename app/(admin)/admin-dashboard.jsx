import AdminProtectedRoute from '../../features/admin/components/AdminProtectedRoute';
import AdminDashboardScreen from '../../features/admin/screens/AdminDashboardScreen';

export default function AdminDashboardRoute() {
  return (
    <AdminProtectedRoute>
      <AdminDashboardScreen />
    </AdminProtectedRoute>
  );
}
