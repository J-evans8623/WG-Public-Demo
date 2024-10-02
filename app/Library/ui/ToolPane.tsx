import React from 'react';
import { Layout, Card } from 'antd';
import ConceptBank from './ConceptBank';

const { Sider } = Layout;

const ToolPane: React.FC = () => {
  return (
    <Sider
      width="100%"
      style={{
        backgroundColor: '#f5f5f5',
        padding: '16px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto', // Allow Sider to scroll if content overflows
      }}
    >
      {/* Concept Bank Card */}
      <Card
        title="Concept Bank"
        styles={{
          header: {
            fontSize: '16px',
            fontWeight: 'bold',
            color: 'rgba(0, 0, 0, 0.85)',
          },
          body: {
            padding: '0',
            flex: 1,
            overflowY: 'auto', // Make the body scrollable
          },
        }}
        style={{
          maxHeight: '300px', // Fixed maximum height
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        {/* ConceptBank Content */}
        <div style={{ padding: '10px' }}>
          <ConceptBank />
        </div>
      </Card>

      {/* Additional Components */}
      <div
        style={{
          marginTop: '20px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Card
          title="Other Tools"
          styles={{
            body: {
              padding: '10px',
              flex: 1,
              overflowY: 'auto',
            },
          }}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          {/* Additional ToolPane components go here */}
          <p>Other tools will be displayed here.</p>
        </Card>
      </div>
    </Sider>
  );
};

export default ToolPane;
