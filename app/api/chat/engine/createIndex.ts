import { MODELS_ENDPOINT } from "./settings";

let requestHeaders: { 
  "Authorization": string; 
  "Content-Type": string; 
  "X-Auth-Provider": string;  
};

async function getSearchEndpointDetails() {
  try {
    const response = await fetch(`${MODELS_ENDPOINT}/freeazuresearch/endpoint/`, {
      headers: requestHeaders,
    });
    const jsonResponse = await response.json();
    const searchServiceEndpoint = jsonResponse.endpoint;
    const searchIndexName = jsonResponse.indexName;
    console.log(`Your Azure AI Search Endpoint: ${searchServiceEndpoint}; Index Name: ${searchIndexName}`);
    return { endpoint: searchServiceEndpoint, indexName: searchIndexName };
  } catch (error) {
    console.error("Error while retrieving search service details", error);
  }
}

async function createUploadSession() {
  try {
    const response = await fetch(`${MODELS_ENDPOINT}/freeazuresearch/files/createUploadSession`, {
      method: "POST",
      headers: requestHeaders,
    });
  
    const jsonResponse = await response.json();
    const uploadSessionId = jsonResponse.id;
    console.log(`Created upload session ${uploadSessionId}.`);
    return uploadSessionId;
  } catch (error) {
    console.error("Error while creating upload session", error);
  }
}

export async function createSearchService() {
  const githubToken = process.env.GITHUB_TOKEN;
  requestHeaders = {
    "Authorization": `Bearer ${githubToken}`,
    "Content-Type": "application/json",
    "X-Auth-Provider": "github",
  };

  await createUploadSession();
  return getSearchEndpointDetails();
}
