import React from 'react';
import { render } from 'react-dom';

import * as Sentry from '@sentry/react';
import { useLocation, useNavigationType, createRoutesFromChildren, matchRoutes } from 'react-router-dom';
import { appService } from '@/_services';
import { App } from './App';
// eslint-disable-next-line import/no-unresolved
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';

const AppWithProfiler = Sentry.withProfiler(App);

appService
  .getConfig()
  .then((config) => {
    console.log({ config });

    window.public_config = config;
    const language = config.LANGUAGE || 'en';
    const path = config?.SUB_PATH || '/';
    i18n
      .use(Backend)
      .use(initReactI18next)
      .init({
        load: 'languageOnly',
        fallbackLng: 'en',
        lng: language,
        backend: {
          loadPath: `${path}assets/translations/{{lng}}.json`,
        },
      });

    if (window.public_config.APM_VENDOR === 'sentry') {
      const tooljetServerUrl = window.public_config.TOOLJET_SERVER_URL;
      const tracingOrigins = ['localhost', /^\//];
      const releaseVersion = window.public_config.RELEASE_VERSION
        ? `tooljet-${window.public_config.RELEASE_VERSION}`
        : 'tooljet';

      if (tooljetServerUrl) tracingOrigins.push(tooljetServerUrl);

      Sentry.init({
        dsn: window.public_config.SENTRY_DNS,
        debug: !!window.public_config.SENTRY_DEBUG,
        release: releaseVersion,
        name: 'react',
        integrations: [
          new Sentry.BrowserTracing({
            routingInstrumentation: Sentry.reactRouterV6Instrumentation(
              React.useEffect,
              useLocation,
              useNavigationType,
              createRoutesFromChildren,
              matchRoutes
            ),
          }),
        ],
        tracesSampleRate: 0.5,
        tracePropagationTargets: tracingOrigins,
      });
    }
  })
  .then(() => render(<AppWithProfiler />, document.getElementById('app')));
// .then(() => createRoot(document.getElementById('app')).render(<AppWithProfiler />));
