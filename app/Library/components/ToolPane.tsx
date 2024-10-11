import React from 'react';
import { Layout, Card } from 'antd';
import ConceptBank from './ConceptBank';

const { Sider } = Layout;

const ToolPane: React.FC = () => {
  return (
    <Sider
      width="100%"
      style={{
        backgroundColor: '#F9FBFD',
        padding: '16px',
        overflowY: 'auto', // Allow vertical scrolling
        height: '100%', // Ensure it takes the full height
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Card for Concept Bank */}
      <Card title="Concept Bank" style={{ flexGrow: 1, overflowY: 'auto' }}>
        <ConceptBank />
      </Card>

      {/* Placeholder for additional components */}
    </Sider>
  );
};

export default ToolPane;
