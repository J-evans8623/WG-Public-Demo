// app/contact/page.tsx

import React from 'react';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';

/**
 * @file app/contact/page.tsx
 * @description
 *   Contact page for WiseGraph.
 *   Provides a clear way for visitors to reach out and lists the primary
 *   email aliases (hello, support) along with their purposes.
 */

export default function ContactPage(): JSX.Element {
  return (
    <div className="wg-page">
      <SiteHeader />

      <main
        style={{
          minHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '60px 24px',
        }}
      >

        {/* Contact Aliases Table */}
        <div style={{ width: '100%', maxWidth: '640px' }}>

          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              backgroundColor: '#ffffff',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)',
              borderRadius: '8px',
              overflow: 'hidden',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #E2E4E7',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    color: '#2c3e50',
                  }}
                >
                   Details
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #E2E4E7',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    color: '#2c3e50',
                  }}
                >
                  Email
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>

                <td
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #F1F2F4',
                    fontSize: '0.95rem',
                    color: '#546b81',
                  }}
                >
                  General questions, product feedback, testimonials, and
                  partnership inquiries.
                </td>
                <td
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #F1F2F4',
                    fontSize: '0.95rem',
                    color: '#E34432',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <a
                    href="mailto:hello@wisegraph.app"
                    style={{
                      color: '#E34432',
                      textDecoration: 'none',
                      borderBottom: '1px solid rgba(227, 68, 50, 0.25)',
                      paddingBottom: '1px',
                    }}
                  >
                    hello@wisegraph.app
                  </a>
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: '12px 16px',
                    fontSize: '0.95rem',
                    color: '#546b81',
                  }}
                >
                  Technical issues, account or billing problems, and help using
                  WiseGraph.
                </td>
                <td
                  style={{
                    padding: '12px 16px',
                    fontSize: '0.95rem',
                    color: '#E34432',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <a
                    href="mailto:support@wisegraph.app"
                    style={{
                      color: '#E34432',
                      textDecoration: 'none',
                      borderBottom: '1px solid rgba(227, 68, 50, 0.25)',
                      paddingBottom: '1px',
                    }}
                  >
                    support@wisegraph.app
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
