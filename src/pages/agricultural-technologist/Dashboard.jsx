import { useAuth } from '../../context/AuthContext';

function AgriculturalTechnologistDashboard() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6f8' }}>
      <nav style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)'
      }}>
        <div>
          <h1 style={{ color: 'white', margin: 0, fontSize: '24px' }}>AGAPAY</h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.8)', margin: '4px 0 0 0', fontSize: '14px' }}>
            Agricultural Management System
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ color: 'white', fontSize: '14px' }}>
            Welcome, {user?.name}
          </span>
          <button
            onClick={handleLogout}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
            onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
          >
            Logout
          </button>
        </div>
      </nav>

      <div style={{ padding: '32px 24px' }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '32px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <h2 style={{
            color: '#333',
            fontSize: '28px',
            marginBottom: '8px',
            marginTop: 0
          }}>
            Agricultural Technologist Dashboard
          </h2>
          <p style={{ color: '#666', marginBottom: '24px' }}>
            Technical support and field operations
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px',
            marginTop: '32px'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              padding: '24px',
              borderRadius: '8px',
              color: 'white'
            }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>Beneficiaries</h3>
              <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>View beneficiary information</p>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              padding: '24px',
              borderRadius: '8px',
              color: 'white'
            }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>Interventions</h3>
              <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>Manage intervention programs</p>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              padding: '24px',
              borderRadius: '8px',
              color: 'white'
            }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>Inventory</h3>
              <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>Check resource availability</p>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
              padding: '24px',
              borderRadius: '8px',
              color: 'white'
            }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>Crisis Reports</h3>
              <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>Submit field reports</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AgriculturalTechnologistDashboard;
