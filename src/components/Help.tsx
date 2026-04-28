import React, { useState, useEffect } from 'react';
import * as fileFormatsConfig from '../config/fileFormats.json';

const Help: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'getting-started' | 'file-formats' | 'transcription' | 'translation' | 'batch-processing' | 'troubleshooting' | 'search'>('getting-started');
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const checkWidth = () => {
      setIsNarrow(window.innerWidth <= 800);
    };
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  const sections = {
    'getting-started': {
      title: 'Getting Started',
      content: (
        <div>
          <h3>Welcome to AI.Opensubtitles.com Web Client</h3>
          <p>This web application provides professional-grade transcription and translation services with both single-file and batch processing capabilities. Process individual files with detailed control, or automate bulk operations with advanced workflow management.</p>

          <h4>Quick Start</h4>
          <ol>
            <li><strong>Login:</strong> Enter your OpenSubtitles credentials on the login screen</li>
            <li><strong>Choose Processing Mode:</strong>
              <ul style={{ marginTop: '8px', marginBottom: '8px' }}>
                <li><strong>Single File Screen:</strong> For single files with immediate results and detailed control</li>
                <li><strong>Batch Screen:</strong> For multiple files with automated workflow and bulk processing</li>
              </ul>
            </li>
            <li><strong>Add Files:</strong> Drag & drop or select one or multiple audio/video/subtitle files</li>
            <li><strong>Configure Options:</strong> Choose AI models, languages, and output settings</li>
            <li><strong>Process:</strong> Start processing and monitor progress in real-time</li>
            <li><strong>Review Results:</strong> Preview and download your processed files</li>
          </ol>

          <h4>Main Features</h4>
          <ul>
            <li><strong>Transcription:</strong> Convert audio/video to text subtitles</li>
            <li><strong>Translation:</strong> Translate existing subtitle files to different languages</li>
            <li><strong>Batch Processing:</strong> Process multiple files automatically with advanced workflow control</li>
            <li><strong>Language Detection:</strong> Automatic detection of audio/subtitle language</li>
            <li><strong>Smart Chaining:</strong> Automatically transcribe then translate files in sequence</li>
            <li><strong>Subtitle Search:</strong> Find and download subtitles from the OpenSubtitles database</li>
            <li><strong>Format Support:</strong> Wide range of video, audio, and subtitle formats</li>
          </ul>

          <h4>Processing Modes</h4>
          <ul>
            <li><strong>Single File Screen:</strong> Single file processing with immediate results and detailed control</li>
            <li><strong>Batch Screen:</strong> Multi-file processing with automation, progress tracking, and bulk operations</li>
          </ul>

          <h4>Navigation</h4>
          <p>Use the sidebar to navigate between screens. The sidebar provides quick access to all features including:</p>
          <ul>
            <li><strong>Single File:</strong> Process individual audio/video/subtitle files</li>
            <li><strong>Batch:</strong> Process multiple files at once</li>
            <li><strong>Recent Media:</strong> View previously processed files</li>
            <li><strong>Search:</strong> Find subtitles in the OpenSubtitles database</li>
            <li><strong>Info:</strong> View AI model information and pricing</li>
            <li><strong>Credits:</strong> Check balance and purchase credits</li>
            <li><strong>Preferences:</strong> Configure application settings</li>
          </ul>
        </div>
      )
    },
    'file-formats': {
      title: 'Supported File Formats',
      content: (
        <div>
          <h3>Video Formats</h3>
          <p>{fileFormatsConfig.video.map(format => format.toUpperCase()).join(', ')}</p>

          <h3>Audio Formats</h3>
          <p>{fileFormatsConfig.audio.map(format => format.toUpperCase()).join(', ')}</p>

          <h3>Subtitle Formats</h3>
          <p>{fileFormatsConfig.subtitle.map(format => format.toUpperCase()).join(', ')}</p>

          <h4>Processing Notes</h4>
          <ul>
            <li>Video files: Audio is extracted automatically for transcription</li>
            <li>Audio files: Processed directly</li>
            <li>All files: Processing time depends on file size and complexity</li>
            <li>Files are uploaded to the server for processing — ensure a stable internet connection</li>
          </ul>

          <h4>Best Practices</h4>
          <ul>
            <li>Use high-quality audio for better transcription accuracy</li>
            <li>Avoid heavily compressed audio formats when possible</li>
            <li>Clear speech with minimal background noise works best</li>
            <li>Large files may take longer to upload — consider file size when on slower connections</li>
          </ul>
        </div>
      )
    },
    'transcription': {
      title: 'Audio Transcription',
      content: (
        <div>
          <h3>How Transcription Works</h3>
          <p>The transcription service converts spoken audio into text subtitles using advanced AI models.</p>

          <h4>Process Steps</h4>
          <ol>
            <li><strong>File Upload:</strong> Your file is uploaded to the server; audio is extracted from video files automatically</li>
            <li><strong>Language Detection:</strong> System identifies the spoken language (if auto-detection is enabled in Preferences)</li>
            <li><strong>AI Processing:</strong> Advanced models transcribe speech to text</li>
            <li><strong>Subtitle Generation:</strong> Text is formatted into timed subtitle files</li>
          </ol>

          <h4>Supported Languages</h4>
          <p>The system supports numerous languages with varying model availability. Language detection helps select the best model for your content. Visit the <strong>Info</strong> screen to see all available models and their supported languages.</p>

          <h4>Tips for Better Results</h4>
          <ul>
            <li>Use clear, well-recorded audio</li>
            <li>Minimize background noise</li>
            <li>Single speaker works better than multi-speaker content</li>
            <li>Standard speech patterns produce more accurate results</li>
          </ul>

          <h4>Output Format</h4>
          <p>Transcriptions are provided as subtitle files (SRT or VTT) with precise timestamps, ready for use with media players or further editing. You can download the result directly from your browser.</p>
        </div>
      )
    },
    'translation': {
      title: 'Subtitle Translation',
      content: (
        <div>
          <h3>How Translation Works</h3>
          <p>The translation service converts subtitle files from one language to another while preserving timing information.</p>

          <h4>Process Steps</h4>
          <ol>
            <li><strong>Upload Subtitles:</strong> Select SRT or VTT subtitle files</li>
            <li><strong>Language Detection:</strong> System identifies source language</li>
            <li><strong>Target Selection:</strong> Choose desired output language</li>
            <li><strong>AI Translation:</strong> Advanced models translate text content</li>
            <li><strong>Format Preservation:</strong> Timing and structure remain intact</li>
          </ol>

          <h4>Language Support</h4>
          <p>Wide range of language pairs supported. The system shows compatible models based on your source language. Visit the <strong>Info</strong> screen for a full list of supported languages per model.</p>

          <h4>Quality Features</h4>
          <ul>
            <li>Context-aware translation</li>
            <li>Preservation of subtitle timing</li>
            <li>Handling of special characters and formatting</li>
            <li>Appropriate sentence length for reading speed</li>
          </ul>

          <h4>Best Practices</h4>
          <ul>
            <li>Start with accurate source subtitles</li>
            <li>Review translations for context accuracy</li>
            <li>Consider cultural adaptations for idioms</li>
          </ul>
        </div>
      )
    },
    'batch-processing': {
      title: 'Batch Processing',
      content: (
        <div>
          <h3>Batch Processing Overview</h3>
          <p>The Batch Processing feature allows you to process multiple files automatically with advanced workflow control and intelligent file management.</p>

          <h4>Getting Started with Batch Processing</h4>
          <ol>
            <li><strong>Access Batch Mode:</strong> Click "Batch" in the sidebar to switch to batch processing mode</li>
            <li><strong>Add Multiple Files:</strong> Use "Select Files" button or drag & drop multiple files at once</li>
            <li><strong>Configure Settings:</strong> Set transcription/translation options that apply to all files</li>
            <li><strong>Start Processing:</strong> Click "Start Batch Processing" to process all files sequentially</li>
          </ol>

          <h4>Batch Processing Features</h4>
          <ul>
            <li><strong>Multi-File Selection:</strong> Process dozens of files in one operation</li>
            <li><strong>Smart Language Detection:</strong> Individual language detection for each file</li>
            <li><strong>Per-File Language Selection:</strong> Override detected languages with specific variants (e.g., 'en-US', 'en-GB')</li>
            <li><strong>Mixed File Types:</strong> Process audio, video, and subtitle files together</li>
            <li><strong>Progress Tracking:</strong> Real-time progress for each file and overall batch</li>
            <li><strong>Error Handling:</strong> Continue processing or stop on first error (configurable)</li>
          </ul>

          <h4>Smart Chaining Workflow</h4>
          <p>The powerful chaining feature automatically processes files in sequence:</p>
          <ol>
            <li><strong>Transcription First:</strong> Audio/video files are transcribed to text</li>
            <li><strong>Auto-Translation:</strong> Resulting subtitles are automatically translated</li>
            <li><strong>Language Preservation:</strong> Detected source languages are preserved for translation</li>
          </ol>

          <h4>File Queue Management</h4>
          <ul>
            <li><strong>Reorder Files:</strong> Use <i className="fas fa-arrow-up"></i> <i className="fas fa-arrow-down"></i> buttons to change processing order</li>
            <li><strong>Remove Files:</strong> Click <i className="fas fa-times"></i> to remove unwanted files from queue</li>
            <li><strong>File Information:</strong> View detected language, file type, and progress for each file</li>
            <li><strong>Individual Settings:</strong> Each file can have different source language variants</li>
          </ul>

          <h4>Best Practices</h4>
          <ul>
            <li><strong>File Organization:</strong> Group similar files (same language/type) for efficient processing</li>
            <li><strong>Network Stability:</strong> Ensure stable internet connection for large batches</li>
            <li><strong>Credit Planning:</strong> Check available credits before starting large batches</li>
            <li><strong>Test Small Batches:</strong> Start with a few files to verify settings before processing many</li>
            <li><strong>Language Verification:</strong> Review auto-detected languages and adjust variants as needed</li>
          </ul>

          <h4>Batch Processing vs Single File</h4>
          <div style={{ marginTop: '20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border-color)' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <th style={{ padding: '12px', border: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-primary)' }}>Feature</th>
                  <th style={{ padding: '12px', border: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-primary)' }}>Single File</th>
                  <th style={{ padding: '12px', border: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-primary)' }}>Batch Processing</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '12px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}><strong>File Capacity</strong></td>
                  <td style={{ padding: '12px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>One file at a time</td>
                  <td style={{ padding: '12px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>Multiple files simultaneously</td>
                </tr>
                <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <td style={{ padding: '12px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}><strong>Workflow</strong></td>
                  <td style={{ padding: '12px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>Manual per-file processing</td>
                  <td style={{ padding: '12px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>Automated sequential processing</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}><strong>Language Settings</strong></td>
                  <td style={{ padding: '12px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>Per-session global settings</td>
                  <td style={{ padding: '12px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>Per-file individual settings</td>
                </tr>
                <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <td style={{ padding: '12px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}><strong>Chaining</strong></td>
                  <td style={{ padding: '12px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>Manual transcribe <i className="fas fa-arrow-right"></i> translate</td>
                  <td style={{ padding: '12px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>Automatic transcribe <i className="fas fa-arrow-right"></i> translate</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}><strong>Best For</strong></td>
                  <td style={{ padding: '12px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>Testing, single files, immediate results</td>
                  <td style={{ padding: '12px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>Large volumes, automation, bulk processing</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h4>Troubleshooting Batch Processing</h4>
          <ul>
            <li><strong>Stuck Processing:</strong> Check network connection, refresh the page if needed</li>
            <li><strong>Mixed Results:</strong> Review per-file error messages in the queue display</li>
            <li><strong>Language Issues:</strong> Verify source language selections match file content</li>
            <li><strong>Credit Depletion:</strong> Processing stops when credits are exhausted</li>
            <li><strong>Large Batches:</strong> Consider processing in smaller groups for better reliability</li>
          </ul>
        </div>
      )
    },
    'troubleshooting': {
      title: 'Troubleshooting',
      content: (
        <div>
          <h3>Common Issues & Solutions</h3>

          <h4>Connection Issues</h4>

          <h5>Processing Failures</h5>
          <ul>
            <li><strong>Check Connection:</strong> Ensure you have a stable internet connection</li>
            <li><strong>File Format:</strong> Verify your file is in a supported format (see Supported File Formats)</li>
            <li><strong>File Size:</strong> Very large files may time out on slower connections — try a smaller file first</li>
            <li><strong>Refresh Page:</strong> If the app becomes unresponsive, refresh the browser page</li>
          </ul>

          <h5>Rate Limiting Errors</h5>
          <ul>
            <li><strong>Wait Period:</strong> The system enforces brief delays between requests</li>
            <li><strong>Batch Processing:</strong> Process smaller groups of files at once</li>
            <li><strong>Credit Usage:</strong> Check remaining credits — processing pauses when exhausted</li>
            <li><strong>Multiple Tabs:</strong> Avoid running the app in multiple browser tabs simultaneously</li>
          </ul>

          <h5>CloudFlare Protection Errors</h5>
          <ul>
            <li><strong>Automatic Retry:</strong> The app automatically retries CloudFlare-protected requests</li>
            <li><strong>Browser Check:</strong> CloudFlare may be performing security checks</li>
            <li><strong>Wait and Retry:</strong> Usually resolves within 1-2 minutes</li>
            <li><strong>Clear Browser Data:</strong> If persistent, clear browser cache and reload</li>
          </ul>

          <h5>Timeout Errors</h5>
          <ul>
            <li><strong>Large Files:</strong> Processing may take several minutes for long audio/video</li>
            <li><strong>Slow Connection:</strong> Check internet speed, consider smaller files first</li>
            <li><strong>Server Load:</strong> Peak usage times may cause delays</li>
            <li><strong>Polling Settings:</strong> Increase polling timeout in Preferences if tasks time out prematurely</li>
          </ul>

          <h5>Authentication Errors</h5>
          <ul>
            <li><strong>Invalid Credentials:</strong> Verify username and password on the login screen</li>
            <li><strong>Session Expired:</strong> Log out and log back in if your session has expired</li>
            <li><strong>Account Issues:</strong> Check your OpenSubtitles account status on the website</li>
            <li><strong>API Key:</strong> The API key is pre-configured and should not need changes</li>
          </ul>

          <h4>Browser-Specific Issues</h4>
          <ul>
            <li><strong>Supported Browsers:</strong> Use a modern browser (Chrome, Firefox, Safari, Edge)</li>
            <li><strong>JavaScript:</strong> Ensure JavaScript is enabled</li>
            <li><strong>Local Storage:</strong> The app uses local storage for settings — ensure it is not blocked</li>
            <li><strong>Ad Blockers:</strong> Some ad blockers may interfere with API requests — try disabling if issues occur</li>
            <li><strong>Private/Incognito Mode:</strong> Settings will not persist across sessions in private browsing</li>
          </ul>

          <h4>Credits</h4>
          <ul>
            <li><strong>Balance:</strong> Check remaining credits via the floating badge (top-right) or the Credits screen</li>
            <li><strong>Usage:</strong> Credits are consumed when processing files</li>
            <li><strong>Monitoring:</strong> Credit balance updates in real-time after each operation</li>
            <li><strong>Depletion:</strong> Processing automatically stops when credits are exhausted</li>
            <li><strong>Purchase:</strong> Buy more credits from the Credits screen</li>
          </ul>

          <h4>When to Contact Support</h4>
          <ul>
            <li><strong>Persistent Errors:</strong> Issues lasting more than 30 minutes</li>
            <li><strong>Repeated Authentication Errors:</strong> With verified correct credentials</li>
            <li><strong>Missing Results:</strong> Processing completes but output is empty or incorrect</li>
            <li><strong>Regional Issues:</strong> If the API appears blocked in your geographic region</li>
          </ul>
        </div>
      )
    },
    'search': {
      title: 'Subtitle Search',
      content: (
        <div>
          <h3>Subtitle Search</h3>
          <p>
            Search the OpenSubtitles database to find and download subtitles for your movies and TV shows.
            The search feature offers three different methods to find exactly what you need.
          </p>

          <h4>Search Methods</h4>

          <h5><i className="fas fa-video"></i> Search Movies & TV Shows</h5>
          <p>Browse the OpenSubtitles movie and TV show database:</p>
          <ul>
            <li>Search by title, year, and media type (movie/episode)</li>
            <li>View detailed information including IMDb/TMDB IDs</li>
            <li>Click "Find Subtitles" to search for subtitles for that specific title</li>
            <li>Results show posters, ratings, and release information</li>
          </ul>

          <h5><i className="fas fa-film"></i> Search Subtitles</h5>
          <p>Search directly for subtitle files:</p>
          <ul>
            <li><strong>Basic Search:</strong> Enter movie/show name and select language</li>
            <li><strong>Advanced Options:</strong> Filter by IMDb ID, release year, and media type</li>
            <li><strong>Language Selection:</strong> Choose from 50+ languages (your preference is saved)</li>
            <li><strong>Results Display:</strong> Shows quality badges (HD, HI), uploader info, download counts, and ratings</li>
          </ul>

          <h5><i className="fas fa-file-video"></i> Search by File</h5>
          <p>Upload your video file for exact subtitle matching:</p>
          <ul>
            <li>Drag & drop or browse to select your video file</li>
            <li>The app calculates a unique file fingerprint (moviehash)</li>
            <li>Finds subtitles that match your exact video file, even if the filename changed</li>
            <li>Most accurate method for finding perfectly synced subtitles</li>
            <li>Optional language filter (or search all languages)</li>
          </ul>

          <h4>Search Results</h4>
          <p>Subtitle search results display comprehensive information:</p>
          <ul>
            <li><strong>Title & Year:</strong> Movie or TV show name with release year</li>
            <li><strong>Quality Badges:</strong> HD, HI (Hearing Impaired), AI (auto-generated)</li>
            <li><strong>Release Info:</strong> Specific release version the subtitle is for</li>
            <li><strong>Details:</strong> Language, download count, file size, FPS, number of CDs</li>
            <li><strong>Uploader:</strong> Username and rank (Trusted, Gold, Silver, Bronze)</li>
            <li><strong>Upload Date:</strong> When the subtitle was added</li>
          </ul>

          <h4>Downloading Subtitles</h4>
          <p>Click "Download SRT" on any result to download:</p>
          <ul>
            <li>The subtitle file downloads directly to your browser's default download location</li>
            <li>Files are in standard SRT format, compatible with all media players</li>
            <li>Filename is based on the subtitle release name</li>
          </ul>

          <h4>Understanding AI.OpenSubtitles.com Results</h4>
          <section style={{
            padding: '16px',
            backgroundColor: 'var(--bg-tertiary)',
            borderLeft: '4px solid #9C27B0',
            borderRadius: '4px',
            marginTop: '16px',
            marginBottom: '16px'
          }}>
            <p style={{ margin: 0, fontSize: '14px' }}>
              <strong style={{ color: '#9C27B0' }}>Note:</strong> You may see results with uploader "AI.OpenSubtitles.com".
              These represent on-demand translations that will be created by OpenSubtitles when you download them (not by this app).
              They appear when human-uploaded subtitles don't exist in your requested language.
            </p>
          </section>

          <h5>What are AI.OpenSubtitles.com Results?</h5>
          <p>
            These are <strong>on-demand translations</strong> that OpenSubtitles will create for you when you download them.
            They appear in search results when:
          </p>
          <ul>
            <li>No human-uploaded subtitles exist in your requested language</li>
            <li>Both target and source languages are supported by DeepL</li>
            <li>A source subtitle exists that can be translated</li>
          </ul>
          <p>
            <strong>Important:</strong> These subtitles don't exist yet when you see them in search results.
            They are generated on-the-fly by OpenSubtitles when you click "Download SRT", using DeepL translation technology.
          </p>

          <h5>How to Identify Them</h5>
          <p>Potential on-demand translations are clearly marked with:</p>
          <ul>
            <li><strong>Purple "AI" badge</strong> in the quality badges section</li>
            <li><strong>Clickable purple "AI.OpenSubtitles.com" uploader badge</strong> (click to learn more)</li>
          </ul>

          <h5>Quality Considerations</h5>
          <ul>
            <li><strong>Generated when you download</strong> — Translation happens in real-time on OpenSubtitles servers</li>
            <li><strong>Generally high quality</strong> — DeepL is one of the best translation systems</li>
            <li><strong>Best for:</strong> Standard dialogue, common phrases, general conversation</li>
            <li><strong>May need review for:</strong> Technical terms, wordplay, idioms, cultural references</li>
            <li><strong>Free to use</strong> — Same as regular subtitles, no extra cost</li>
            <li><strong>Valuable for:</strong> Rare language pairs or new content without human translations</li>
          </ul>

          <h4>Tips for Better Search Results</h4>
          <ul>
            <li><strong>Use IMDb ID:</strong> For most accurate results, search by IMDb ID (found on IMDb.com)</li>
            <li><strong>Try file-based search:</strong> Upload your video file for perfect sync matches</li>
            <li><strong>Check release version:</strong> Ensure the subtitle release matches your video file release</li>
            <li><strong>Sort by downloads:</strong> Popular subtitles tend to have better quality</li>
            <li><strong>Look for trusted uploaders:</strong> Users with "Trusted" rank provide reliable content</li>
          </ul>
        </div>
      )
    }
  };

  const sectionKeys = Object.keys(sections) as (keyof typeof sections)[];

  const NavTabs = () => (
    <div style={{
      display: 'flex',
      background: 'var(--bg-tertiary)',
      borderBottom: '1px solid var(--border-color)',
      overflowX: 'auto',
      flexShrink: 0,
      scrollbarWidth: 'thin'
    }}>
      {sectionKeys.map((key) => (
        <button
          key={key}
          onClick={() => setActiveSection(key)}
          style={{
            padding: '12px 16px',
            background: activeSection === key ? 'var(--button-bg)' : 'transparent',
            color: activeSection === key ? 'var(--button-text)' : 'var(--text-primary)',
            border: 'none',
            borderBottom: activeSection === key ? '2px solid var(--button-bg)' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '13px',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s ease'
          }}
        >
          {sections[key].title}
        </button>
      ))}
    </div>
  );

  const NavDropdown = () => (
    <div style={{
      padding: '12px 16px',
      background: 'var(--bg-tertiary)',
      borderBottom: '1px solid var(--border-color)'
    }}>
      <select
        value={activeSection}
        onChange={(e) => setActiveSection(e.target.value as keyof typeof sections)}
        style={{
          width: '100%',
          padding: '10px 12px',
          background: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '4px',
          fontSize: '14px',
          cursor: 'pointer'
        }}
      >
        {sectionKeys.map((key) => (
          <option key={key} value={key}>
            {sections[key].title}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      gap: '0'
    }}><h1>Help & Documentation</h1>
      {/* Compact Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '1em 0',
        borderBottom: '1px solid var(--border-color)'
      }}>
        
      </div>

      {/* Navigation */}
      {isNarrow ? <NavDropdown /> : <NavTabs />}

      {/* Content Area */}
      <div style={{
        flex: 1,
        padding: '20px',
        overflowY: 'auto',
        lineHeight: '1.6'
      }}>
        <style>{`
          .help-content h3 {
            color: var(--button-bg);
            margin-top: 24px;
            margin-bottom: 12px;
            font-size: 18px;
            border-bottom: 2px solid var(--border-color);
            padding-bottom: 5px;
          }
          .help-content h4 {
            color: var(--text-primary);
            margin-top: 20px;
            margin-bottom: 10px;
            font-size: 15px;
          }
          .help-content h5 {
            color: var(--text-primary);
            margin-top: 16px;
            margin-bottom: 8px;
            font-size: 14px;
          }
          .help-content p {
            margin-bottom: 12px;
            color: var(--text-secondary);
          }
          .help-content ul, .help-content ol {
            margin-bottom: 16px;
            padding-left: 20px;
          }
          .help-content li {
            margin-bottom: 6px;
            color: var(--text-secondary);
          }
          .help-content li strong {
            color: var(--text-primary);
          }
          .help-content code {
            background: var(--bg-tertiary);
            color: var(--text-primary);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
          }
        `}</style>
        <div className="help-content">
          {sections[activeSection].content}
        </div>
      </div>
    </div>
  );
};

export default Help;
