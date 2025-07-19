import {
  DefaultAzureCredential,
  getBearerTokenProvider,
  ManagedIdentityCredential,
} from "@azure/identity";
import {
  AzureKeyCredential,
  KnownAnalyzerNames,
  KnownVectorSearchAlgorithmKind,
} from "@azure/search-documents";

import { OpenAI, OpenAIEmbedding, Settings } from "llamaindex";

// FIXME: import from 'llamaindex'
import {
  AzureAISearchVectorStore,
  IndexManagement,
 } from "llamaindex/vector-store/AzureAISearchVectorStore"

import { createSearchService } from "./createIndex";

const CHUNK_SIZE = 512;
const CHUNK_OVERLAP = 20;
const AZURE_COGNITIVE_SERVICES_SCOPE =
  "https://cognitiveservices.azure.com/.default";
export const MODELS_ENDPOINT = "https://models.inference.ai.azure.com";

async function createAzureAISearchOptions(
  azureAiSearchVectorStoreAuth: {
    key?: string;
    credential?: DefaultAzureCredential | ManagedIdentityCredential;
  },
  githubToken?: string
) {
  const commonOptions = {
    serviceApiVersion: "2024-09-01-preview",
    indexManagement: IndexManagement.CREATE_IF_NOT_EXISTS,
    languageAnalyzer: KnownAnalyzerNames.EnLucene,
    vectorAlgorithmType: KnownVectorSearchAlgorithmKind.ExhaustiveKnn,
  };

  if (!githubToken) {
    return {
      ...azureAiSearchVectorStoreAuth,
      endpoint: process.env.AZURE_AI_SEARCH_ENDPOINT,
      indexName: process.env.AZURE_AI_SEARCH_INDEX ?? "llamaindex-vector-search",
      idFieldKey: process.env.AZURE_AI_SEARCH_ID_FIELD ?? "id",
      chunkFieldKey: process.env.AZURE_AI_SEARCH_CHUNK_FIELD ?? "chunk",
      embeddingFieldKey: process.env.AZURE_AI_SEARCH_EMBEDDING_FIELD ?? "embedding",
      metadataStringFieldKey: process.env.AZURE_AI_SEARCH_METADATA_FIELD ?? "metadata",
      docIdFieldKey: process.env.AZURE_AI_SEARCH_DOC_ID_FIELD ?? "doc_id",
      embeddingDimensionality: Number(process.env.AZURE_AI_SEARCH_EMBEDDING_DIMENSIONALITY) ?? 1536,
      ...commonOptions,
    };
  }

  const searchService = await createSearchService();
  if (!searchService) {
    throw new Error("Failed to retrieve search service details.");
  }

  return {
    credential: new AzureKeyCredential(githubToken),
    endpoint: searchService.endpoint,
    indexName: searchService.indexName,
    idFieldKey: "chunk_id",
    chunkFieldKey: "chunk",
    embeddingFieldKey: "text_vector",
    metadataStringFieldKey: "parent_id",
    docIdFieldKey: "chunk_id",
    embeddingDimensionality: 1536,
    ...commonOptions,
  };
}

function createEmbeddingParams(
  openAiConfig: {
    apiKey?: string;
    deployment?: string;
    model?: string;
    azure?: Record<string, string | CallableFunction>;
  },
  githubToken?: string
) {
  if (!githubToken) {
    return {
      ...openAiConfig,
      model: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
      azure: {
        ...openAiConfig.azure,
        deployment: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
      },
    };
  }

  return {
    model: "text-embedding-3-small",
    apiKey: githubToken,
    additionalSessionOptions: {
      baseURL: MODELS_ENDPOINT,
    },
  };
}

function createOpenAiParams(
  openAiConfig: {
    apiKey?: string;
    deployment?: string;
    model?: string;
    azure?: Record<string, string | CallableFunction>;
  },
  githubToken?: string
) {
  if (!githubToken) {
    return {
      ...openAiConfig,
      model: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT,
    };
  }

  return {
    apiKey: githubToken,
    additionalSessionOptions: {
      baseURL: MODELS_ENDPOINT
    },
    model: "gpt-4o",
  }
}

function validateEnvironmentVariables() {
  const areOpenAiChatAndEmbeddingDeploymentConfigured =
    process.env.AZURE_OPENAI_CHAT_DEPLOYMENT && process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT;
  const isGithubTokenConfigured = process.env.GITHUB_TOKEN;
  if (!areOpenAiChatAndEmbeddingDeploymentConfigured && !isGithubTokenConfigured) {
    throw new Error(
      "Environment variables 'AZURE_OPENAI_CHAT_DEPLOYMENT' and 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT' must be set, or a valid GITHUB_TOKEN must be provided."
    );
  }
}

export const initSettings = async () => {
  validateEnvironmentVariables();
  
  let credential;
  const githubToken = process.env.GITHUB_TOKEN;
  const azureAiSearchVectorStoreAuth: {
    key?: string;
    credential?: DefaultAzureCredential | ManagedIdentityCredential;
  } = {};
  const openAiConfig: {
    apiKey?: string;
    deployment?: string;
    model?: string;
    azure?: Record<string, string | CallableFunction>;
  } = {};

  if (process.env.OPENAI_API_KEY) {
    // Authenticate using an Azure OpenAI API key
    // This is generally discouraged, but is provided for developers
    // that want to develop locally inside the Docker container.
    openAiConfig.apiKey = process.env.OPENAI_API_KEY;
    console.log("Using OpenAI API key for authentication");
  } else if (process.env.AZURE_CLIENT_ID) {
    // Authenticate using a user-assigned managed identity on Azure
    // See infra/main.bicep for value of AZURE_OPENAI_CLIENT_ID
    credential = new ManagedIdentityCredential({
      clientId: process.env.AZURE_CLIENT_ID,
    });
    console.log("Using managed identity for authentication");
    console.log({ clientId: process.env.AZURE_CLIENT_ID });
  } else {
    // Authenticate using the default Azure credential chain
    // See https://learn.microsoft.com/en-us/azure/developer/javascript/sdk/authentication/overview#use-defaultazurecredential-in-an-application
    // This will *not* work inside a Docker container.
    credential = new DefaultAzureCredential();
    console.log("Using default Azure credential chain for authentication");
  }

  if (credential) {
    const azureADTokenProvider = getBearerTokenProvider(
      credential,
      AZURE_COGNITIVE_SERVICES_SCOPE,
    );
    openAiConfig.azure = {
      azureADTokenProvider,
      ...(process.env.AZURE_OPENAI_CHAT_DEPLOYMENT && {
      deployment: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT,
      }),
    };

    azureAiSearchVectorStoreAuth.credential = credential;
  }

  if (process.env.AZURE_AI_SEARCH_KEY) {
    // Authenticate using an Azure AI Search API key
    // This is generally discouraged, but is provided for developers
    // that want to develop locally inside the Docker container.
    azureAiSearchVectorStoreAuth.key = process.env.AZURE_AI_SEARCH_KEY;
  }

  // configure LLM model
  Settings.llm = new OpenAI(createOpenAiParams(openAiConfig, githubToken));
  console.log({ openAiConfig });

  // configure embedding model
  Settings.embedModel = new OpenAIEmbedding(createEmbeddingParams(openAiConfig, githubToken));

  Settings.chunkSize = CHUNK_SIZE;
  Settings.chunkOverlap = CHUNK_OVERLAP;

  // FIXME: find an elegant way to share the same instance across the ingestion and
  // generation pipelines

  const azureAiSearchOptions = await createAzureAISearchOptions(azureAiSearchVectorStoreAuth, githubToken);
  console.log("Initializing Azure AI Search Vector Store");

  (Settings as any).__AzureAISearchVectorStoreInstance__ = new AzureAISearchVectorStore(azureAiSearchOptions);
};
