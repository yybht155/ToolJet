import got, { HTTPError, OptionsOfTextResponseBody } from 'got';
import urrl from 'url';
import { QueryError, OAuthUnauthorizedClientError } from './query.error';
import { getCurrentToken } from './utils.helper';
import { QueryResult } from './query_result.type';
import { App } from './app.type';
import { User } from './user.type';
import { CookieJar } from 'tough-cookie';
import { isEmpty } from 'lodash';

export function checkIfContentTypeIsURLenc(headers: [string, string][] = []): boolean {
  const contentType = headers.find(([key, _]) => key.toLowerCase() === 'content-type')?.[1];
  return contentType?.toLowerCase() === 'application/x-www-form-urlencoded';
}

export function checkIfContentTypeIsMultipartFormData(headers: [string, string][] = []): boolean {
  const contentType = headers.find(([key, _]) => key.toLowerCase() === 'content-type')?.[1];
  return contentType?.toLowerCase().startsWith('multipart/form-data') ?? false;
}

export function checkIfContentTypeIsJson(headers: [string, string][] = []): boolean {
  const contentType = headers.find(([key, _]) => key.toLowerCase() === 'content-type')?.[1];
  return (
    (contentType?.toLowerCase().startsWith('application/json') || contentType?.toLowerCase().startsWith('text/json')) ??
    false
  );
}

export function sanitizeParams(customArray: any) {
  const params = Object.fromEntries(customArray ?? []);
  Object.keys(params).forEach((key) => (params[key] === '' ? delete params[key] : {}));
  return params;
}

export function validateAndSetRequestOptionsBasedOnAuthType(
  sourceOptions: any,
  context: { user?: User; app?: App },
  requestOptions: OptionsOfTextResponseBody,
  additionalOptions?: any
): QueryResult | Promise<QueryResult> {
  switch (sourceOptions['auth_type']) {
    case 'oauth2':
    case 'oauth':
      return handleOAuthAuthentication(sourceOptions, context, requestOptions);
    case 'bearer':
      return handleBearerAuthentication(sourceOptions, requestOptions);
    case 'apiKey':
      return handleApiKeyAuthentication(sourceOptions, requestOptions, additionalOptions);
    case 'basic':
      return handleBasicAuthentication(sourceOptions, requestOptions);
    default:
      return { status: 'ok', data: { ...requestOptions } };
  }
}

async function handleOAuthAuthentication(
  sourceOptions: any,
  context: { user?: User; app?: App },
  requestOptions: any
): Promise<QueryResult> {
  const headers = { ...requestOptions.headers };
  const oAuthValidatedResult = await validateAndMaybeSetOAuthHeaders(sourceOptions, context, headers);
  if (oAuthValidatedResult.status !== 'ok') {
    return oAuthValidatedResult;
  }
  return { status: 'ok', data: { ...requestOptions, headers } };
}

function handleBearerAuthentication(sourceOptions: any, requestOptions: any): QueryResult {
  const headers = { ...requestOptions.headers };
  headers['Authorization'] = `Bearer ${sourceOptions.bearer_token}`;
  return { status: 'ok', data: { ...requestOptions, headers } };
}

function handleApiKeyAuthentication(sourceOptions, requestOptions, additionalOptions): QueryResult {
  let cookieJar = new CookieJar();

  const resolved = resolveApiKeyParams(
    sourceOptions.api_keys,
    sourceOptions.auth_key,
    requestOptions.headers,
    additionalOptions.url,
    requestOptions.searchParams,
    cookieJar
  );
  const header = resolved.header;
  cookieJar = resolved.cookieJar;

  return {
    status: 'ok',
    data: {
      ...{ ...requestOptions, searchParams: resolved.query },
      headers: header,
      cookieJar,
    },
  };
}

function handleBasicAuthentication(sourceOptions: any, requestOptions: any): QueryResult {
  return {
    status: 'ok',
    data: { ...requestOptions, username: sourceOptions.username, password: sourceOptions.password },
  };
}

async function validateAndMaybeSetOAuthHeaders(sourceOptions, context, headers): Promise<QueryResult> {
  const authType = sourceOptions['auth_type'];
  const requiresOauth = authType === 'oauth2' || authType === 'oauth';

  if (requiresOauth) {
    const isMultiAuthEnabled = sourceOptions['multiple_auth_enabled'];
    const grantType = sourceOptions['grant_type'];
    const tokenData = sourceOptions['tokenData'];
    const isAppPublic = context?.app.isPublic;
    const userData = context?.user;
    const currentToken = getCurrentToken(isMultiAuthEnabled, tokenData, userData?.id, isAppPublic);

    if (!currentToken && !userData?.id && isAppPublic) {
      throw new QueryError('Missing access token', {}, {});
    }

    if (!currentToken) {
      if (grantType === 'client_credentials') {
        return handleClientCredentialsGrant(sourceOptions, headers);
      } else {
        return handleAuthorizationCodeGrant(sourceOptions);
      }
    } else {
      const accessToken = currentToken['access_token'];
      if (sourceOptions['add_token_to'] === 'header') {
        const headerPrefix = sourceOptions['header_prefix'];
        headers['Authorization'] = `${headerPrefix}${accessToken}`;
      }
    }
  }

  return { status: 'ok', data: headers };
}

async function handleClientCredentialsGrant(sourceOptions: any, headers: any): Promise<QueryResult> {
  try {
    const data = await getTokenForClientCredentialsGrant(sourceOptions);
    const accessToken = data['access_token'];
    if (sourceOptions['add_token_to'] === 'header') {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return { status: 'ok', data: headers };
  } catch (error) {
    throw new QueryError('Failed to fetch access token', {}, {});
  }
}

function handleAuthorizationCodeGrant(sourceOptions: any): QueryResult {
  return {
    status: 'needs_oauth',
    data: { auth_url: getAuthUrl(sourceOptions) },
  };
}

async function getTokenForClientCredentialsGrant(sourceOptions: any) {
  if (
    isEmpty(sourceOptions.access_token_url) ||
    isEmpty(sourceOptions.client_id) ||
    isEmpty(sourceOptions.client_secret)
  ) {
    throw new Error('Missing required fields in sourceOptions');
  }

  const headersObject = sanitizeParams(sourceOptions.access_token_custom_headers);

  try {
    const requestBody = new URLSearchParams({
      grant_type: sourceOptions.grant_type || 'client_credentials',
      client_id: sourceOptions.client_id,
      client_secret: sourceOptions.client_secret,
      ...(sourceOptions.audience ? { audience: sourceOptions.audience } : {}),
      ...(sourceOptions.scopes ? { scope: sourceOptions.scopes } : {}),
    });

    const response = await got.post(sourceOptions.access_token_url, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(Object.keys(headersObject).length > 0 && headersObject),
      },
      body: requestBody.toString(),
      responseType: 'json',
    });

    return response.body;
  } catch (error) {
    throw new Error(`Failed to fetch token: ${error.message}`);
  }
}

export function getAuthUrl(sourceOptions: any): string {
  const customQueryParams = sanitizeParams(sourceOptions['custom_query_params']);
  const host = process.env.TOOLJET_HOST;
  const subpath = process.env.SUB_PATH;
  const fullUrl = `${host}${subpath ? subpath : '/'}`;

  const authUrl = new URL(
    `${sourceOptions['auth_url']}?response_type=code&client_id=${sourceOptions['client_id']}&redirect_uri=${fullUrl}oauth2/authorize&scope=${sourceOptions['scopes']}`
  );
  Object.entries(customQueryParams).map(([key, value]) => authUrl.searchParams.append(key, value));
  return authUrl.toString();
}

function resolveApiKeyParams(apiKeys, auth_key: string, header: any, url: URL, query: any, cookieJar: any) {
  const processKey = (type: string, name: string, value: string) => {
    if (type === 'header') {
      header[name] = value;
    } else if (type === 'query') {
      query[name] = value;
    } else if (type === 'cookie') {
      cookieJar.setCookie(`${name}=${value}`, url);
    }
  };
  apiKeys.map((key: any) => {
    if (key.parentKey && key.parentKey === auth_key) {
      //process multiple keys
      key.fields.map((field: any) => {
        processKey(field.in, field.name, field.value);
      });
    } else {
      if (auth_key === key.key) {
        processKey(key.in, key.name, key.value);
        return;
      }
    }
  });

  return { header, query, cookieJar };
}

export const getRefreshedToken = async (sourceOptions: any, error: any, userId: string, isAppPublic: boolean) => {
  let refreshToken: string;
  if (sourceOptions && 'multiple_auth_enabled' in sourceOptions) {
    const isMultiAuthEnabled = sourceOptions['multiple_auth_enabled'];
    const currentToken = getCurrentToken(isMultiAuthEnabled, sourceOptions['tokenData'], userId, isAppPublic);
    refreshToken = currentToken['refresh_token'];
  } else {
    refreshToken = sourceOptions['tokenData']['refresh_token'];
  }

  if (!refreshToken) {
    throw new QueryError('Refresh token not found', error.response, {});
  }
  const accessTokenUrl = sourceOptions['access_token_url'];
  const clientId = sourceOptions['client_id'];
  const clientSecret = sourceOptions['client_secret'];
  const grantType = 'refresh_token';
  const isUrlEncoded = checkIfContentTypeIsURLenc(sourceOptions['access_token_custom_headers']);
  const customAccessTokenHeaders = sanitizeParams(sourceOptions['access_token_custom_headers']);

  const data = {
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: grantType,
    refresh_token: refreshToken,
  };

  const accessTokenDetails = {};
  let result: any, response: any;

  try {
    response = await got(accessTokenUrl, {
      method: 'post',
      headers: {
        'Content-Type': isUrlEncoded ? 'application/x-www-form-urlencoded' : 'application/json',
        ...customAccessTokenHeaders,
      },
      form: isUrlEncoded ? data : undefined,
      json: !isUrlEncoded ? data : undefined,
    });
    result = JSON.parse(response.body);
  } catch (error) {
    console.error(
      `Error while REST API refresh token call. Status code : ${error.response?.statusCode}, Message : ${error.response?.body}`
    );
    if (error instanceof HTTPError) {
      result = {
        requestObject: {
          requestUrl: error.request?.requestUrl,
          requestHeaders: error.request?.options?.headers,
          requestParams: urrl.parse(error.request?.requestUrl, true).query,
        },
        responseObject: {
          statusCode: error.response?.statusCode,
          responseBody: error.response?.body,
        },
        responseHeaders: error.response?.headers,
      };
    }
    if (error.response?.statusCode >= 400 && error.response?.statusCode < 500) {
      throw new OAuthUnauthorizedClientError(
        'Unauthorized status from Oauth server',
        JSON.stringify({ statusCode: error.response?.statusCode, message: error.response?.body }),
        result
      );
    }
    throw new QueryError(
      'could not connect to Oauth server',
      JSON.stringify({ statusCode: error.response?.statusCode, message: error.response?.body }),
      result
    );
  }

  if (!(response.statusCode >= 200 || response.statusCode < 300)) {
    throw new QueryError(
      'could not connect to Oauth server. status code',
      JSON.stringify({ statusCode: response.statusCode }),
      {
        responseObject: {
          statusCode: response.statusCode,
          responseBody: response.body,
        },
        responseHeaders: response.headers,
      }
    );
  }

  if (result['access_token']) {
    accessTokenDetails['access_token'] = result['access_token'];
    accessTokenDetails['refresh_token'] = result['refresh_token'] || refreshToken;
  } else {
    throw new QueryError(
      'access_token not found in the response',
      {},
      {
        responseObject: {
          statusCode: response.statusCode,
          responseBody: response.body,
        },
        responseHeaders: response.headers,
      }
    );
  }
  return accessTokenDetails;
};
