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
