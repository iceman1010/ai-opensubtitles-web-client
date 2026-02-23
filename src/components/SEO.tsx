import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

interface SEOProps {
  title: string;
  description: string;
  type?: string;
  name?: string;
}

const SEO: React.FC<SEOProps> = ({ 
  title, 
  description, 
  type = 'website',
  name = 'AI.OpenSubtitles.com' 
}) => {
  const location = useLocation();
  const siteUrl = 'https://ai.opensubtitles.com';
  const fullUrl = `${siteUrl}${location.pathname}`;

  return (
    <Helmet>
      {/* Standard metadata */}
      <title>{title} | {name}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={fullUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:site_name" content={name} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  );
};

export default SEO;
