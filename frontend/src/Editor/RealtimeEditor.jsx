/* eslint-disable import/no-unresolved */
import React from 'react';
import config from 'config';
import { RoomProvider } from '@y-presence/react';
import Spinner from '@/_ui/Spinner';
import { Editor } from '@/AppBuilder';
const Y = require('yjs');
const psl = require('psl');
const { WebsocketProvider } = require('y-websocket');

const ydoc = new Y.Doc();

const getWebsocketUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const apiUrlStartsWithProtocol = config.apiUrl.startsWith('http');

  let url;

  if (apiUrlStartsWithProtocol) {
    url = `${config.apiUrl.replace(/(^\w+:|^)\/\//, '').replace('/api', '')}`;
  } else {
    url = `${window.location.host}${config.apiUrl.replace(/(^\w+:|^)\/\//, '').replace('/api', '')}`;
  }

  return `${protocol}://${url}`;
};

export const RealtimeEditor = (props) => {
  const appId = props.id;
  const [provider, setProvider] = React.useState();

  React.useEffect(() => {
    /* TODO: when we convert the editor.jsx to fn component. please try to avoid this extra call */
    const domain = psl.parse(window.location.host).domain;
    document.cookie = domain ? `domain=.${domain}; path=/` : `path=/`;
    document.cookie = domain ? `app_id=${appId}; domain=.${domain}; path=/` : `app_id=${appId}; path=/`;
    document.cookie = `app_id=${appId}; domain=.${domain}; path=/`;
    setProvider(new WebsocketProvider(getWebsocketUrl(), 'yjs', ydoc));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  React.useEffect(() => {
    const ERROR_CODE_WEBSOCKET_AUTH_FAILED = 4000;
    if (provider) {
      provider?.on('connection-close', (e) => {
        if (e.code === ERROR_CODE_WEBSOCKET_AUTH_FAILED) provider.disconnect();
      });
    }

    () => provider.disconnect();
  }, [provider]);

  if (!provider) return <Spinner />;

  const initialPresence = {
    firstName: '',
    lastName: '',
    email: '',
    image: '',
    editingVersionId: '',
    x: 0,
    y: 0,
    color: '',
  };

  return (
    <RoomProvider awareness={provider.awareness} initialPresence={initialPresence}>
      <Editor provider={provider} ymap={ydoc.getMap('appDef')} {...props} />
    </RoomProvider>
  );
};
