import AdminProtectedRoute from '../../features/admin/components/AdminProtectedRoute';
import AdminUsersScreen from '../../features/admin/screens/AdminUsersScreen';

export default function AdminUsersRoute() {
  return (
    <AdminProtectedRoute>
      <AdminUsersScreen />
    </AdminProtectedRoute>
  );
}
