import R from 'ramda';
import React from 'react';
import { HotKeys } from 'react-hotkeys';

import { EDITOR_MODE, SELECTION_ENTITY_TYPE } from '../../../constants';
import { isEntitySelected } from '../../../utils';
import { isInput } from '../../../../utils/browser';
import { COMMAND } from '../../../../utils/constants';

import PatchSVG from '../../../../project/components/PatchSVG';
import * as Layers from '../../../../project/components/layers';

import { snapNodePositionToSlots } from '../../../../project/nodeLayout';

import {
  bindApi,
  getMousePosition,
  getOffsetMatrix,
  isMiddleButtonPressed,
} from '../modeUtils';

const isSelectionModifierPressed = event => event.metaKey || event.ctrlKey;

let patchSvgRef = null;

const selectingMode = {
  getInitialState() {
    return {
      isMouseDownOnMovableObject: false,
      dragStartPosition: { x: 0, y: 0 },
    };
  },

  onEntityMouseDown({ props, setState }, entityType, event, entityId) {
    if (isMiddleButtonPressed(event)) return;

    const mousePosition = getMousePosition(patchSvgRef, props.offset, event);

    if (isEntitySelected(entityType, props.selection, entityId)) {
      if (isSelectionModifierPressed(event)) {
        props.actions.deselectEntity(entityType, entityId);
        setState({ isMouseDownOnMovableObject: false });
      } else {
        // Don't set selection to this single entity
        // to allow user to move already selected group of entities.
        // We'll handle it in `onEntityMouseUp`
        setState({
          isMouseDownOnMovableObject: true,
          dragStartPosition: mousePosition,
        });
      }
    } else if (isSelectionModifierPressed(event)) {
      props.actions.addEntityToSelection(entityType, entityId);
      setState({
        isMouseDownOnMovableObject: true,
        dragStartPosition: mousePosition,
      });
    } else {
      props.actions.selectEntity(entityType, entityId);
      setState({
        isMouseDownOnMovableObject: true,
        dragStartPosition: mousePosition,
      });
    }
  },
  onEntityMouseUp({ props, setState }, entityType, event, entityId) {
    if (isMiddleButtonPressed(event)) return;

    if (
      !isSelectionModifierPressed(event) &&
      isEntitySelected(entityType, props.selection, entityId) &&
      props.selection.length > 1
    ) {
      props.actions.selectEntity(entityType, entityId);
    }

    setState({ isMouseDownOnMovableObject: false });
  },

  onCommentResizeHandleMouseDown(api, event, commentId) {
    if (isMiddleButtonPressed(event)) return;

    api.goToMode(
      EDITOR_MODE.RESIZING_COMMENT,
      {
        resizedCommentId: commentId,
        dragStartPosition: getMousePosition(patchSvgRef, api.props.offset, event),
      }
    );
  },
  onPinMouseDown(api, event, nodeId, pinKey) {
    if (isMiddleButtonPressed(event)) return;

    const didSelectPin = api.props.actions.doPinSelection(nodeId, pinKey);
    if (didSelectPin) {
      const mousePosition = getMousePosition(patchSvgRef, api.props.offset, event);
      api.goToMode(EDITOR_MODE.LINKING, { mousePosition });
    }
  },
  onLinkClick(api, id) {
    if (id.length > 0) {
      api.props.actions.selectLink(id);
    } else {
      api.props.actions.deselectAll();
    }
  },
  onMouseDown(api, event) {
    if (!isMiddleButtonPressed(event)) return;

    const mousePosition = getMousePosition(patchSvgRef, api.props.offset, event);
    api.goToMode(EDITOR_MODE.PANNING, { isPanning: true, panningStartPosition: mousePosition });
  },
  onMouseMove(api, event) {
    if (!api.state.isMouseDownOnMovableObject) return;

    api.goToMode(
      EDITOR_MODE.MOVING_SELECTION,
      {
        dragStartPosition: api.state.dragStartPosition,
        mousePosition: getMousePosition(patchSvgRef, api.props.offset, event),
      }
    );
  },
  onMouseUp(api) {
    api.setState({ isMouseDownOnMovableObject: false });
  },
  onKeyDown(api, event) {
    if (isInput(event)) return;

    if (event.key === ' ' && !api.state.isMouseDownOnMovableObject) {
      api.goToMode(EDITOR_MODE.PANNING, { isPanning: false });
    }
  },
  onDeleteSelection(api, event) {
    if (isInput(event)) return;

    api.props.actions.deleteSelection();
  },
  onBackgroundClick(api, event) {
    // to prevent misclicks when selecting multiple entities
    if (isSelectionModifierPressed(event)) return;

    api.props.actions.deselectAll();
  },
  onBackgroundDoubleClick(api, event) {
    R.compose(
      api.props.onDoubleClick,
      snapNodePositionToSlots,
      getMousePosition
    )(patchSvgRef, api.props.offset, event);
  },
  getHotkeyHandlers(api) {
    return {
      [COMMAND.DELETE_SELECTION]: bindApi(api, this.onDeleteSelection),
      [COMMAND.DESELECT]: api.props.actions.deselectAll,
    };
  },
  render(api) {
    return (
      <HotKeys
        handlers={this.getHotkeyHandlers(api)}
        className="PatchWrapper"
        onKeyDown={bindApi(api, this.onKeyDown)}
      >
        <PatchSVG
          onMouseDown={bindApi(api, this.onMouseDown)}
          onMouseMove={bindApi(api, this.onMouseMove)}
          onMouseUp={bindApi(api, this.onMouseUp)}
          svgRef={(svg) => { patchSvgRef = svg; }}
        >
          <Layers.Background
            width={api.props.size.width}
            height={api.props.size.height}
            onClick={bindApi(api, this.onBackgroundClick)}
            onDoubleClick={bindApi(api, this.onBackgroundDoubleClick)}
            offset={api.props.offset}
          />
          <g transform={getOffsetMatrix(api.props.offset)}>
            <Layers.Comments
              comments={api.props.comments}
              selection={api.props.selection}
              onMouseDown={R.partial(this.onEntityMouseDown, [api, SELECTION_ENTITY_TYPE.COMMENT])}
              onMouseUp={R.partial(this.onEntityMouseUp, [api, SELECTION_ENTITY_TYPE.COMMENT])}
              onResizeHandleMouseDown={bindApi(api, this.onCommentResizeHandleMouseDown)}
              onFinishEditing={api.props.actions.editComment}
            />
            <Layers.Links
              links={api.props.links}
              selection={api.props.selection}
            />
            <Layers.Nodes
              nodes={api.props.nodes}
              selection={api.props.selection}
              linkingPin={api.props.linkingPin}
              onMouseDown={R.partial(this.onEntityMouseDown, [api, SELECTION_ENTITY_TYPE.NODE])}
              onMouseUp={R.partial(this.onEntityMouseUp, [api, SELECTION_ENTITY_TYPE.NODE])}
            />
            <Layers.LinksOverlay
              links={api.props.links}
              selection={api.props.selection}
              onClick={bindApi(api, this.onLinkClick)}
            />
            <Layers.NodePinsOverlay
              nodes={api.props.nodes}
              linkingPin={api.props.linkingPin}
              onPinMouseDown={bindApi(api, this.onPinMouseDown)}
            />
          </g>
        </PatchSVG>
      </HotKeys>
    );
  },
};

export default selectingMode;
