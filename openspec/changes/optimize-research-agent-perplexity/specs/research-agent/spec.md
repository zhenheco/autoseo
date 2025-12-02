## ADDED Requirements

### Requirement: Unified Perplexity Research Query

ResearchAgent SHALL execute a single unified Perplexity API query that combines all research needs (trends, user questions, authority data, and external references) into one request.

#### Scenario: Single API call for complete research

- **WHEN** ResearchAgent receives a title and region
- **THEN** it SHALL call Perplexity API exactly once
- **AND** the query SHALL request trends, common questions, statistics, and reference sources in a single structured prompt
- **AND** the response SHALL be parsed to extract all research components

#### Scenario: Reduced API cost

- **WHEN** ResearchAgent completes research for an article
- **THEN** the total Perplexity API calls SHALL be 1 (previously 4)
- **AND** the approximate cost reduction SHALL be 75%

### Requirement: Flexible External Reference Acceptance

ResearchAgent SHALL accept any relevant external references returned by Perplexity without restricting to specific source types (Wikipedia, academic, official docs).

#### Scenario: Accept service provider websites

- **WHEN** the article topic is a commercial service (e.g., "春酒活動快剪快播")
- **AND** Perplexity returns citations from service provider websites
- **THEN** ResearchAgent SHALL accept these as valid external references
- **AND** SHALL NOT return "cannot find authoritative sources" error

#### Scenario: Accept industry blogs and tutorials

- **WHEN** Perplexity returns citations from industry blogs, tutorial sites, or news articles
- **THEN** ResearchAgent SHALL accept these as valid external references
- **AND** SHALL categorize them appropriately using extended type definitions

### Requirement: Extended External Reference Types

The system SHALL support additional external reference types to accurately categorize commercial and industry sources.

#### Scenario: New type definitions

- **WHEN** categorizing external references
- **THEN** the following types SHALL be available:
  - `wikipedia`: Encyclopedia entries
  - `official_docs`: Official documentation
  - `research`: Academic or research publications
  - `news`: News articles
  - `blog`: General blog posts
  - `service`: Service provider websites (NEW)
  - `industry`: Industry-specific information sites (NEW)
  - `tutorial`: Tutorial or how-to guides (NEW)

#### Scenario: URL categorization for service providers

- **WHEN** a URL contains patterns indicating a service provider (e.g., company domain, product pages)
- **THEN** the system SHALL categorize it as `service` type
- **AND** SHALL not default to `blog` for commercial sites

### Requirement: Deep Research Data Structure

ResearchAgent SHALL return deep research data in a structured format extracted from the unified query response.

#### Scenario: Trends data extraction

- **WHEN** the unified query response contains trend information
- **THEN** the `deepResearch.trends` object SHALL contain:
  - `content`: The trend analysis text
  - `citations`: Related source URLs
  - `executionTime`: Time taken for this extraction

#### Scenario: User questions data extraction

- **WHEN** the unified query response contains FAQ or common questions
- **THEN** the `deepResearch.userQuestions` object SHALL contain parsed questions and answers

#### Scenario: Authority data extraction

- **WHEN** the unified query response contains statistics or authoritative data
- **THEN** the `deepResearch.authorityData` object SHALL contain the extracted data with citations

## MODIFIED Requirements

### Requirement: External References Fallback

The system SHALL provide fallback external references when Perplexity returns no citations, but SHALL NOT fail the research process.

#### Scenario: Empty citations from Perplexity

- **WHEN** Perplexity returns an empty citations array
- **THEN** the system SHALL generate default external references
- **AND** SHALL log a warning but continue the article generation process

#### Scenario: Perplexity API failure

- **WHEN** the Perplexity API call fails
- **THEN** the system SHALL return undefined for deepResearch
- **AND** SHALL provide default external references
- **AND** SHALL continue the article generation process with available data

## REMOVED Requirements

### Requirement: Strict Source Type Priority

**Reason**: The previous requirement to prioritize Wikipedia, official docs, and academic sources fails for commercial/service topics where such sources don't exist.

**Migration**: The new "Flexible External Reference Acceptance" requirement replaces this with a more practical approach that accepts any relevant sources.

---

# strategy-agent Spec Delta

## MODIFIED Requirements

### Requirement: AI-Generated Titles Based on Research

StrategyAgent SHALL generate article titles using AI analysis of research data instead of using template-based fallback titles.

#### Scenario: Generate titles from research data

- **WHEN** StrategyAgent needs to generate article titles
- **AND** ResearchAgent has provided research data (trends, user questions, authority data)
- **THEN** StrategyAgent SHALL use AI to analyze the research data
- **AND** generate 3-5 unique, natural titles that reflect the article's value
- **AND** SHALL NOT use template patterns like "{keyword}：{year}年最新實用技巧"

#### Scenario: Title generation without research data

- **WHEN** ResearchAgent fails to provide research data
- **THEN** StrategyAgent SHALL use AI to generate titles based on keyword analysis alone
- **AND** SHALL still avoid template-based patterns

### Requirement: Title Quality Criteria

Generated titles SHALL meet the following quality criteria:

#### Scenario: Natural language titles

- **WHEN** generating article titles
- **THEN** titles SHALL use natural, conversational language
- **AND** SHALL include the target keyword without being forced
- **AND** SHALL reflect the core value proposition of the article
- **AND** SHALL be compelling enough to attract reader clicks

## REMOVED Requirements

### Requirement: Template-Based Fallback Titles

**Reason**: Template titles like "{keyword}：{year}年最新實用技巧" are too formulaic and don't reflect actual article content.

**Migration**: The new "AI-Generated Titles Based on Research" requirement replaces this with AI-powered title generation.

---

# article-storage Spec Delta

## MODIFIED Requirements

### Requirement: Robust HTML Conversion

ArticleStorage SHALL ensure Markdown content is always converted to valid HTML with proper error handling.

#### Scenario: Successful HTML conversion

- **WHEN** saving article content with Markdown
- **THEN** the system SHALL convert Markdown to HTML using marked.parse()
- **AND** SHALL verify the HTML output is non-empty
- **AND** SHALL store both markdown_content and html_content

#### Scenario: HTML conversion failure handling

- **WHEN** marked.parse() returns empty or null result
- **THEN** the system SHALL log an error with full details
- **AND** SHALL attempt fallback conversion
- **AND** SHALL NOT store empty html_content

#### Scenario: Conversion error logging

- **WHEN** any error occurs during HTML conversion
- **THEN** the system SHALL log the error with:
  - Input markdown length
  - Error message and stack trace
  - Article ID and title for debugging
