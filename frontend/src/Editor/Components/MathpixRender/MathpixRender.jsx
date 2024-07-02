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
  // Show in context menu:
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

export const MathpixRender = (props) => {
  const { height, properties, styles, id, setExposedVariable, exposedVariables, fireEvent, dataCy, component } = props;
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
  const { code, data } = properties;
  const [customProps, setCustomProps] = useState(data);
  const dataQueryRef = useRef(dataQueries);
  const customPropRef = useRef(data);

  useEffect(() => {
    setCustomProps(data);
    customPropRef.current = data;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(data)]);

  useEffect(() => {
    if (!isEqual(exposedVariables.data, customProps)) {
      setExposedVariable('data', customProps);
      //   sendMessageToIframe({ message: 'DATA_UPDATED' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setExposedVariable, customProps, exposedVariables.data]);

  useEffect(() => {
    // sendMessageToIframe({ message: 'CODE_UPDATED' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    dataQueryRef.current = dataQueries;
  }, [dataQueries]);

  useEffect(() => {
    window.addEventListener('message', (e) => {
      try {
        if (e.data.from === 'mathpixRender' && e.data.componentId === id) {
          if (e.data.message === 'UPDATE_DATA') {
            setCustomProps({ ...customPropRef.current, ...e.data.updatedObj });
          } else if (e.data.message === 'RUN_QUERY') {
            const filteredQuery = dataQueryRef.current.filter(
              (query) => query.name === e.data.queryName && isQueryRunnable(query)
            );
            const parameters = e.data.parameters ? JSON.parse(e.data.parameters) : {};
            filteredQuery.length === 1 &&
              fireEvent('onTrigger', {
                component,
                queryId: filteredQuery[0].id,
                queryName: filteredQuery[0].name,
                parameters,
              });
          } else {
            // sendMessageToIframe(e.data);
          }
        }
      } catch (err) {
        console.log(err);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [loading, setLoading] = useState(true);

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
    <div className="card">
      <MathpixLoader>
        <MathpixMarkdown text="\\(ax^2 + bx + c = 0\\)" outMath={outMath} accessibility={accessibility} />
        <MathpixMarkdown
          text="$x = \frac { - b \pm \sqrt { b ^ { 2 } - 4 a c } } { 2 a }$"
          outMath={outMath}
          accessibility={accessibility}
        />
      </MathpixLoader>
    </div>
  );
};
