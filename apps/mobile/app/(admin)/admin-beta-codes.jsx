import AdminProtectedRoute from '../../features/admin/components/AdminProtectedRoute';
import AdminBetaCodesScreen from '../../features/admin/screens/AdminBetaCodesScreen';

export default function AdminBetaCodesRoute() {
  return (
    <AdminProtectedRoute>
      <AdminBetaCodesScreen />
    </AdminProtectedRoute>
  );
}
