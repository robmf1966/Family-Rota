import React from 'react';

// --- This component must render if the build and pathing are correct ---
const App = () => {
  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      backgroundColor: '#f0f4f8', 
      padding: '20px' 
    }}>
      <h1 style={{ color: '#4c51bf', fontSize: '2em' }}>TEST SUCCESSFUL!</h1>
      <p style={{ color: '#718096', textAlign: 'center' }}>
        The build and deployment path are FIXED. 
        <br/>
        We can now reintroduce the Rota logic.
      </p>
      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#e9d5ff', borderRadius: '8px' }}>
          <p style={{ fontWeight: 'bold' }}>Code Version: TEST 1.0</p>
      </div>
    </div>
  );
};

export default App;
