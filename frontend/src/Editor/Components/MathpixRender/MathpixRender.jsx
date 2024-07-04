import React, { useEffect, useState, useRef } from 'react';
import { isEqual } from 'lodash';

import { useDataQueries } from '@/_stores/dataQueriesStore';
import { useGridStore } from '@/_stores/gridStore';
import { isQueryRunnable } from '@/_helpers/utils';
import { shallow } from 'zustand/shallow';

import { MathpixMarkdown, MathpixLoader } from 'mathpix-markdown-it';
import { addListenerContextMenuEvents, removeListenerContextMenuEvents } from 'mathpix-markdown-it/lib/contex-menu';
import { loadSre } from 'mathpix-markdown-it/lib/sre/sre-browser';

const outMath = {
  include_svg: true,
  include_smiles: true,
  include_asciimath: true,
  include_latex: true,
  include_mathml: true,
  include_mathml_word: true,
};

let accessibility = {
  assistiveMml: true,
  sre: loadSre(),
};

function renderReplaceLine(text) {
  const textArray = text.split('\n\n');
  const modifiedSteps = textArray.map((step, index) => {
    return replaceNewlinesInBrackets(step);
  });
  return modifiedSteps.join('\n');
}

function replaceNewlinesInBrackets(str) {
  let regex = /\\\[(.*?)\\\]/gs;
  return str.replace(regex, (match, p1) => {
    return `\\\[${p1.replace(/\n/g, ' ')}\\\]`;
  });
}

export const MathpixRender = (props) => {
  const { height, properties, styles, id, setExposedVariable, setExposedVariables, exposedVariables, fireEvent, dataCy, component } = props;
  const dataQueries = useDataQueries();

  const showPlaceholder = useGridStore((state) => {
    const { resizingComponentId, draggingComponentId } = state;
    if (
      (resizingComponentId === null && draggingComponentId === id) ||
      (draggingComponentId === null && resizingComponentId === id) ||
      id === 'resizingComponentId'
    ) {
      return true;
    }
    return false;
  }, shallow);

  const { visibility, boxShadow } = styles;
  const { data } = properties;
  const [customProps, setCustomProps] = useState(data);
  const [finalText, setFinalText] = useState(renderReplaceLine(data));
  const dataQueryRef = useRef(dataQueries);
  const customPropRef = useRef(data);

  useEffect(() => {
    setCustomProps(data);
    customPropRef.current = data;
    setFinalText(renderReplaceLine(data)); // 更新finalText
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // useEffect(() => {
  //   if (!isEqual(exposedVariables.data, customProps)) {
  //     setExposedVariable('data', customProps);
  //     //   sendMessageToIframe({ message: 'DATA_UPDATED' });
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [setExposedVariable, customProps, exposedVariables.data]);

  useEffect(() => {
    dataQueryRef.current = dataQueries;
  }, [dataQueries]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const exposedVariables = {
      setData: async function (data) {
        setCustomProps(data);
        customPropRef.current = data;
        setFinalText(renderReplaceLine(data)); // 更新finalText
      },
      clear: async function () {
        setCustomProps('');
        customPropRef.current = '';
        setFinalText(renderReplaceLine('')); // 更新finalText
      },
    };
    setExposedVariables(exposedVariables);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customProps, properties.data, setCustomProps]);

  /** In order for the math to be accessibility, need to make sure that the sre module is loaded */
  useEffect(() => {
    accessibility.sre.engineReady().finally(() => {
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    addListenerContextMenuEvents();
    return () => {
      removeListenerContextMenuEvents();
    };
  }, []);

  if (loading) {
    return <div className="card">Loading..</div>;
  }
  return (
    <div className="card" style={{ height: height, overflow: 'hidden auto', padding: '10px' }}>
      <MathpixLoader>
        <MathpixMarkdown text={finalText} outMath={outMath} accessibility={accessibility} />
      </MathpixLoader>
    </div>
  );
};