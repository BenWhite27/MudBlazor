﻿window.App = window.App || (function () {
    return {
        reloadIFrame: function (id) {
            const iFrame = document.getElementById(id);
            if (iFrame) {
                iFrame.contentWindow.location.reload();
            }
        },
        changeDisplayUrl: function (url) {
            if (!url) {
                return;
            }

            window.history.pushState(null, null, url);
        }
    };
}());

window.App.CodeEditor = window.App.CodeEditor || (function () {
    let _editor;

    function initEditor(editorId, defaultValue) {
        if (!editorId) {
            return;
        }

        require.config({ paths: { 'vs': 'lib/monaco-editor/min/vs' } });
        require(['vs/editor/editor.main'], () => {
            const oldValue = getValue();
            const oldEditorElement = document.getElementById(editorId);
            if (oldEditorElement && oldEditorElement.childNodes) {
                oldEditorElement.childNodes.forEach(c => oldEditorElement.removeChild(c));
            }

            const value = defaultValue || oldValue ||
                `<h1>Hello World</h1>

@code {

}
`;
            _editor = monaco.editor.create(document.getElementById(editorId), {
                fontSize: '16px',
                value: value,
                language: 'razor'
            });
        });
    }

    function getValue() {
        return _editor && _editor.getValue();
    }

    return {
        init: function (editorId, defaultValue) {
            initEditor(editorId, defaultValue);
        },
        initEditor: initEditor,
        getValue: getValue,
        dispose: function () {
            _editor = null;
        }
    };
}());

window.App.Repl = window.App.Repl || (function () {
    const throttleLastTimeFuncNameMappings = {};

    let _dotNetInstance;
    let _editorContainerId;
    let _resultContainerId;
    let _editorId;

    function setElementHeight(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            // TODO: Abstract class name
            const height = window.innerHeight - document.getElementsByClassName('repl-navbar')[0].offsetHeight;

            element.style.height = `${height}px`;
        }
    }

    function initReplSplitter() {
        if (_editorContainerId &&
            _resultContainerId &&
            document.getElementById(_editorContainerId) &&
            document.getElementById(_resultContainerId)) {

            throttleLastTimeFuncNameMappings['resetEditor'] = new Date();
            Split(['#' + _editorContainerId, '#' + _resultContainerId], {
                elementStyle: (dimension, size, gutterSize) => ({
                    'flex-basis': `calc(${size}% - ${gutterSize + 1}px)`,
                }),
                gutterStyle: (dimension, gutterSize) => ({
                    'flex-basis': `${gutterSize}px`,
                }),
                onDrag: () => throttle(resetEditor, 100, 'resetEditor'),
                onDragEnd: resetEditor
            });
        }
    }

    function resetEditor() {
        const value = window.App.CodeEditor.getValue();
        const oldEditorElement = document.getElementById(_editorId);
        if (oldEditorElement && oldEditorElement.childNodes) {
            oldEditorElement.childNodes.forEach(c => oldEditorElement.removeChild(c));
        }

        window.App.CodeEditor.initEditor(_editorId, value);
    }

    function onWindowResize() {
        setElementHeight(_resultContainerId);
        setElementHeight(_editorContainerId);
        resetEditor();
    }

    function onKeyDown(e) {
        // CTRL + S
        if (e.ctrlKey && e.keyCode === 83) {
            e.preventDefault();
            if (_dotNetInstance && _dotNetInstance.invokeMethodAsync) {
                throttle(() => _dotNetInstance.invokeMethodAsync('TriggerCompileAsync'), 1000, 'compile');
            }
        }
    }

    function throttle(func, timeFrame, id) {
        const now = new Date();
        if (now - throttleLastTimeFuncNameMappings[id] >= timeFrame) {
            func();
            throttleLastTimeFuncNameMappings[id] = now;
        }
    }

    function base64ToArrayBuffer(base64) {
        const binaryString = window.atob(base64);
        const binaryLen = binaryString.length;
        const bytes = new Uint8Array(binaryLen);
        for (let i = 0; i < binaryLen; i++) {
            const ascii = binaryString.charCodeAt(i);
            bytes[i] = ascii;
        }

        return bytes;
    }

    return {
        init: function (editorContainerId, resultContainerId, editorId, dotNetInstance) {
            _dotNetInstance = dotNetInstance;
            _editorContainerId = editorContainerId;
            _resultContainerId = resultContainerId;
            _editorId = editorId;

            throttleLastTimeFuncNameMappings['compile'] = new Date();

            setElementHeight(editorContainerId);
            setElementHeight(resultContainerId);

            initReplSplitter();

            window.addEventListener('resize', onWindowResize);
            window.addEventListener('keydown', onKeyDown);
        },
        updateUserAssemblyInCacheStorage: function (file) {
            const response = new Response(new Blob([base64ToArrayBuffer(file)], { type: 'application/octet-stream' }));

            caches.open('blazor-resources-/').then(function (cache) {
                if (!cache) {
                    // TODO: alert user
                    return;
                }

                cache.keys().then(function (keys) {
                    const keysForDelete = keys.filter(x => x.url.indexOf('UserComponents') > -1);

                    const dll = keysForDelete.find(x => x.url.indexOf('dll') > -1).url.substr(window.location.origin.length);
                    cache.delete(dll).then(function () {
                        cache.put(dll, response).then(function () { });
                    });
                });
            });
        },
        dispose: function () {
            _dotNetInstance = null;
            _editorContainerId = null;
            _resultContainerId = null;
            _editorId = null;

            window.removeEventListener('resize', onWindowResize);
            window.removeEventListener('keydown', onKeyDown);
        }
    };
}());

window.App.SaveSnippetPopup = window.App.SaveSnippetPopup || (function () {
    let _dotNetInstance;
    let _invokerId;
    let _id;

    function closePopupOnWindowClick(e) {
        if (!_dotNetInstance || !_invokerId || !_id) {
            return;
        }

        let currentElement = e.target;
        while (currentElement.id !== _id && currentElement.id !== _invokerId) {
            currentElement = currentElement.parentNode;
            if (!currentElement) {
                _dotNetInstance.invokeMethodAsync('CloseAsync');
                break;
            }
        }
    }

    return {
        init: function (id, invokerId, dotNetInstance) {
            _dotNetInstance = dotNetInstance;
            _invokerId = invokerId;
            _id = id;

            window.addEventListener('click', closePopupOnWindowClick);
        },
        dispose: function () {
            _dotNetInstance = null;
            _invokerId = null;
            _id = null;

            window.removeEventListener('click', closePopupOnWindowClick);
        }
    };
}());
