// privacy-terms/privacy-terms.tsx

'use client';

import React from 'react';
import '@/app/styles/legal/legal-shared.css'; 

/**
 * @file privacy-terms/privacy-terms.tsx
 * @description Static content component for the WiseGraph Privacy Policy.
 * This component is responsible for rendering the privacy agreement text using semantic HTML structure.
 * It is a pure presentation component that imports the shared 'legal-shared.css' to apply the 
 * branded typography and layout defined in Phase 1. This ensures that the Privacy Policy 
 * is visually identical to the Terms of Service, maintaining a cohesive user experience.
 * * * Content Source: "Wisegraph Privacy Policy.docx"
 * * Sections:
 * 1. Information Collection (Inputs vs Automated)
 * 2. Use of Information (Service provision, not selling data)
 * 3. Student Data and AI Model Training (Crucial compliance section)
 * 4. Data Sharing (Third-party vendors)
 * 5. Security (Encryption standards)
 * 6. Data Retention (Lifecycle of data)
 * 7. User Rights (Access and deletion)
 */

const PrivacyPolicyContent = () => {
  return (
    <div className="wg-legal-page">
      <div className="wg-legal-container">
        
        {/* Header */}
        <h1 className="wg-legal-main-title">Privacy Policy</h1>
        <span className="wg-legal-last-updated">Last Updated: November 22, 2025</span>

        {/* Section 1 */}
        <section className="wg-legal-section">
          <h2 className="wg-legal-heading">1. Information Collection</h2>
          <p className="wg-legal-text">
            Wisegraph collects information in two primary ways: information you provide directly and information collected automatically. When you register for an account, we collect Personal Data such as your name, email address, and account credentials. If you use our educational tools, we collect the content you upload or input, such as text prompts or documents. Additionally, we automatically collect technical log data when you access our service, including your Internet Protocol (IP) address, browser type, device information, and usage data regarding how you interact with our features. We may use cookies and similar tracking technologies to maintain your preferences and analyze service performance.</p>
        </section>

        {/* Section 2 */}
        <section className="wg-legal-section">
          <h2 className="wg-legal-heading">2. Use of Information</h2>
          <p className="wg-legal-text">
            We use the information we collect primarily to provide, maintain, and personalize the Wisegraph Service. This includes verifying your identity, processing your inputs to generate educational outputs, and communicating with you regarding account updates. We also use aggregated, de-identified data to analyze usage trends to improve the quality of our educational offerings and develop new features. We do not use your personal information to sell to third parties or for targeted advertising purposes unrelated to the educational context of our Service.</p>
        </section>

        {/* Section 3 - Critical for EdTech */}
        <section className="wg-legal-section">
          <h2 className="wg-legal-heading">3. Student Data and AI Model Training</h2>
          <p className="wg-legal-text">
           Wisegraph is committed to protecting the privacy of students. If our Service is used by schools or districts, we process Student Data solely for educational purposes and in accordance with applicable laws such as FERPA and COPPA.
Crucially, Wisegraph does not use personally identifiable student data or user-generated content to train our third-party Artificial Intelligence models. Any data sent to our AI providers is processed to generate the requested response and to maintain the security and integrity of the service (such as abuse monitoring). Data is not retained by those providers for model training purposes.
</p>
        </section>

        {/* Section 4 */}
        <section className="wg-legal-section">
          <h2 className="wg-legal-heading">4. Data Sharing and Third Parties</h2>
          <p className="wg-legal-text">
            We do not sell your personal information. However, we may disclose your information to trusted third-party vendors and service providers who assist us in operating our Service, such as hosting providers, payment processors, and AI technology providers. These third parties are authorized to use your personal information only as necessary to provide these services to us. We may also disclose your information if required by law, such as to comply with a subpoena or similar legal process, or to protect the rights and safety of Wisegraph and its users.
</p>
        </section>

        {/* Section 5 */}
        <section className="wg-legal-section">
          <h2 className="wg-legal-heading">5. Security</h2>
          <p className="wg-legal-text">
            We employ industry-standard administrative, technical, and physical security measures designed to protect your personal information from unauthorized access, disclosure, or misuse. These measures include encrypting your personal information when it is stored at rest and using secure encryption protocols (such as TLS) during transmission over the internet. While we strive to use commercially acceptable means to protect your personal data, no method of transmission over the Internet is 100% secure.</p>
        </section>

        {/* Section 6 */}
        <section className="wg-legal-section">
          <h2 className="wg-legal-heading">6. Data Retention</h2>
          <p className="wg-legal-text">
            Wisegraph retains your personal data only for as long as necessary to fulfill the purposes for which it was collected, including providing the Service, maintaining your account, and complying with legal obligations. When we have no ongoing legitimate business need to process your personal information, we will either delete or anonymize it. You may request the deletion of your account at any time, subject to our legal retention requirements.
</p>
        </section>

        {/* Section 7 */}
        <section className="wg-legal-section">
          <h2 className="wg-legal-heading">7. User Rights</h2>
          <p className="wg-legal-text">
            Depending on your location, you may have specific rights regarding your personal data. These rights include the ability to access the personal data we hold about you, correct inaccuracies, request the deletion of your personal data, and object to or restrict our processing of your information. You may exercise these rights by contacting us directly or, in some cases, through your account settings. We will not discriminate against you for exercising any of your privacy rights.</p>
        </section>

      </div>
    </div>
  );
};

export default PrivacyPolicyContent;