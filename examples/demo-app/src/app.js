// Copyright (c) 2022 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import React, {Component} from 'react';
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer';
import styled, {ThemeProvider} from 'styled-components';
import window from 'global/window';
import {connect} from 'react-redux';

import {theme} from 'kepler.gl/styles';
import Banner from './components/banner';
import Announcement, {FormLink} from './components/announcement';
import {replaceLoadDataModal} from './factories/load-data-modal';
import {replaceMapControl} from './factories/map-control';
import {replacePanelHeader} from './factories/panel-header';
import {AUTH_TOKENS} from './constants/default-settings';
import {messages} from './constants/localization';
import {KeplerGlLayers} from 'kepler.gl/layers';

import {
  loadRemoteMap,
  loadSampleConfigurations,
  onExportFileSuccess,
  onLoadCloudMapSuccess
} from './actions';

import {loadCloudMap, addDataToMap, addNotification} from 'kepler.gl/actions';
import * as allActions from 'kepler.gl/actions';
import {CLOUD_PROVIDERS} from './cloud-providers';

import {h3IsValid} from 'h3-js';

const KeplerGl = require('kepler.gl/components').injectComponents([
  replaceLoadDataModal(),
  replaceMapControl(),
  replacePanelHeader()
]);

// Sample data
/* eslint-disable no-unused-vars */
import sampleTripData, {testCsvData, sampleTripDataConfig} from './data/sample-trip-data';
import sampleGeojson from './data/sample-small-geojson';
import sampleGeojsonPoints from './data/sample-geojson-points';
import sampleGeojsonConfig from './data/sample-geojson-config';
import sampleH3Data, {config as h3MapConfig} from './data/sample-hex-id-csv';
import sampleS2Data, {config as s2MapConfig, dataId as s2DataId} from './data/sample-s2-data';
import sampleAnimateTrip from './data/sample-animate-trip-data';
import sampleIconCsv, {config as savedMapConfig} from './data/sample-icon-csv';

import {processCsvData, processGeojson} from 'kepler.gl/processors';
/* eslint-enable no-unused-vars */

console.log('Starting demo app.');

console.log({allActions});

const BannerHeight = 48;
const BannerKey = `banner-${FormLink}`;
const keplerGlGetState = state => state.demo.keplerGl;

const GlobalStyle = styled.div`
  font-family: ff-clan-web-pro, 'Helvetica Neue', Helvetica, sans-serif;
  font-weight: 400;
  font-size: 0.875em;
  line-height: 1.71429;

  *,
  *:before,
  *:after {
    -webkit-box-sizing: border-box;
    -moz-box-sizing: border-box;
    box-sizing: border-box;
  }

  ul {
    margin: 0;
    padding: 0;
  }

  li {
    margin: 0;
  }

  a {
    text-decoration: none;
    color: ${props => props.theme.labelColor};
  }
`;

class App extends Component {
  constructor(...props) {
    super(...props);
    this._openDataAggregrationModal = this._openDataAggregrationModal.bind(this);
    this._aggregateData = this._aggregateData.bind(this);
    this._onSelectBaseLayer = this._onSelectBaseLayer.bind(this);
  }

  state = {
    showBanner: false,
    width: window.innerWidth,
    height: window.innerHeight,
    datasets: {},
    dataAggregationModal: {
      isOpen: false,
      baseLayerId: undefined
    }
  };

  componentDidMount() {
    window.app = this;

    // if we pass an id as part of the url
    // we ry to fetch along map configurations
    const {params: {id, provider} = {}, location: {query = {}} = {}} = this.props;

    const cloudProvider = CLOUD_PROVIDERS.find(c => c.name === provider);
    if (cloudProvider) {
      this.props.dispatch(
        loadCloudMap({
          loadParams: query,
          provider: cloudProvider,
          onSuccess: onLoadCloudMapSuccess
        })
      );
      return;
    }

    // Load sample using its id
    if (id) {
      this.props.dispatch(loadSampleConfigurations(id));
    }

    // Load map using a custom
    if (query.mapUrl) {
      // TODO?: validate map url
      this.props.dispatch(loadRemoteMap({dataUrl: query.mapUrl}));
    }

    // delay zs to show the banner
    // if (!window.localStorage.getItem(BannerKey)) {
    //   window.setTimeout(this._showBanner, 3000);
    // }
    // load sample data
    // this._loadSampleData();

    // Notifications
    // this._loadMockNotifications();
  }

  _showBanner = () => {
    this.setState({showBanner: true});
  };

  _hideBanner = () => {
    this.setState({showBanner: false});
  };

  _disableBanner = () => {
    this._hideBanner();
    window.localStorage.setItem(BannerKey, 'true');
  };

  _loadMockNotifications = () => {
    const notifications = [
      [{message: 'Welcome to Kepler.gl'}, 3000],
      [{message: 'Something is wrong', type: 'error'}, 1000],
      [{message: 'I am getting better', type: 'warning'}, 1000],
      [{message: 'Everything is fine', type: 'success'}, 1000]
    ];

    this._addNotifications(notifications);
  };

  _addNotifications(notifications) {
    if (notifications && notifications.length) {
      const [notification, timeout] = notifications[0];

      window.setTimeout(() => {
        this.props.dispatch(addNotification(notification));
        this._addNotifications(notifications.slice(1));
      }, timeout);
    }
  }

  _loadSampleData() {
    this._loadPointData();
    // this._loadGeojsonData();
    this._loadTripGeoJson();
    // this._loadIconData();
    // this._loadH3HexagonData();
    // this._loadS2Data();
    // this._loadScenegraphLayer();
  }

  _loadPointData() {
    this.props.dispatch(
      addDataToMap({
        datasets: {
          info: {
            label: 'Sample Taxi Trips in New York City',
            id: 'test_trip_data'
          },
          data: sampleTripData
        },
        options: {
          centerMap: true,
          readOnly: false
        },
        config: sampleTripDataConfig
      })
    );
  }

  _loadScenegraphLayer() {
    this.props.dispatch(
      addDataToMap({
        datasets: {
          info: {
            label: 'Sample Scenegraph Ducks',
            id: 'test_trip_data'
          },
          data: processCsvData(testCsvData)
        },
        config: {
          version: 'v1',
          config: {
            visState: {
              layers: [
                {
                  type: '3D',
                  config: {
                    dataId: 'test_trip_data',
                    columns: {
                      lat: 'gps_data.lat',
                      lng: 'gps_data.lng'
                    },
                    isVisible: true
                  }
                }
              ]
            }
          }
        }
      })
    );
  }

  _loadIconData() {
    // load icon data and config and process csv file
    this.props.dispatch(
      addDataToMap({
        datasets: [
          {
            info: {
              label: 'Icon Data',
              id: 'test_icon_data'
            },
            data: processCsvData(sampleIconCsv)
          }
        ]
      })
    );
  }

  _loadTripGeoJson() {
    this.props.dispatch(
      addDataToMap({
        datasets: [
          {
            info: {label: 'Trip animation'},
            data: processGeojson(sampleAnimateTrip)
          }
        ]
      })
    );
  }

  _loadGeojsonData() {
    // load geojson
    this.props.dispatch(
      addDataToMap({
        datasets: [
          {
            info: {label: 'Bart Stops Geo', id: 'bart-stops-geo'},
            data: processGeojson(sampleGeojsonPoints)
          },
          {
            info: {label: 'SF Zip Geo', id: 'sf-zip-geo'},
            data: processGeojson(sampleGeojson)
          }
        ],
        options: {
          keepExistingConfig: true
        },
        config: sampleGeojsonConfig
      })
    );
  }

  _loadH3HexagonData() {
    // load h3 hexagon
    this.props.dispatch(
      addDataToMap({
        datasets: [
          {
            info: {
              label: 'H3 Hexagons V2',
              id: 'h3-hex-id'
            },
            data: processCsvData(sampleH3Data)
          }
        ],
        config: h3MapConfig,
        options: {
          keepExistingConfig: true
        }
      })
    );
  }

  _loadS2Data() {
    // load s2
    this.props.dispatch(
      addDataToMap({
        datasets: [
          {
            info: {
              label: 'S2 Data',
              id: s2DataId
            },
            data: processCsvData(sampleS2Data)
          }
        ],
        config: s2MapConfig,
        options: {
          keepExistingConfig: true
        }
      })
    );
  }

  _toggleCloudModal = () => {
    // TODO: this lives only in the demo hence we use the state for now
    // REFCOTOR using redux
    this.setState({
      cloudModalOpen: !this.state.cloudModalOpen
    });
  };

  _getMapboxRef = (mapbox, index) => {
    if (!mapbox) {
      // The ref has been unset.
      // https://reactjs.org/docs/refs-and-the-dom.html#callback-refs
      // console.log(`Map ${index} has closed`);
    } else {
      // We expect an InteractiveMap created by KeplerGl's MapContainer.
      // https://uber.github.io/react-map-gl/#/Documentation/api-reference/interactive-map
      const map = mapbox.getMap();
      map.on('zoomend', e => {
        // console.log(`Map ${index} zoom level: ${e.target.style.z}`);
      });
    }
  };

  _openDataAggregrationModal() {
    this.setState(prevState => ({
      ...prevState,
      dataAggregationModal: {
        ...prevState.dataAggregationModal,
        isOpen: true,
        baseLayerId: this._getLayers()[0].id
      }
    }));
  }

  _aggregateData() {
    const {baseLayerId} = this.state.dataAggregationModal;
    const baseLayer = this._getLayers().find(layer => layer.id === baseLayerId);
    const baseDatasetId = baseLayer.config.dataId;
    const baseSet = this.state.datasets[baseDatasetId];
    if (baseSet === undefined) {
      throw new Error('No base set is selected.');
    }
    const otherSets = [];
    console.log('TODO otherSets');
    const newBaseSet = aggregateData(baseSet, otherSets);

    this.props.dispatch(
      addDataToMap({
        datasets: {
          info: {
            label: newBaseSet.label,
            id: newBaseSet.id
          },
          data: newBaseSet.processed
        }
      })
    );

    const fieldsToShow = this.props.demo.keplerGl.map.visState.interactionConfig.tooltip.config
      .fieldsToShow[baseDatasetId];
    if (!fieldsToShow.some(f => f.name === 'TotalRisk')) {
      this.props.dispatch(
        allActions.interactionConfigChange({
          ...this.props.demo.keplerGl.map.visState.interactionConfig.tooltip,
          config: {
            ...this.props.demo.keplerGl.map.visState.interactionConfig.tooltip.config,
            fieldsToShow: {
              ...this.props.demo.keplerGl.map.visState.interactionConfig.tooltip.config
                .fieldsToShow,
              [baseDatasetId]: fieldsToShow.concat([{name: 'TotalRisk', format: null}])
            }
          }
        })
      );
    }

    this.setState(prevState => ({
      ...prevState,
      dataAggregationModal: {...prevState.dataAggregationModal, isOpen: false}
    }));
  }

  _onSelectBaseLayer(e) {
    const layerId = e.target.value;
    this.setState(prevState => ({
      ...prevState,
      dataAggregationModal: {...prevState.dataAggregationModal, baseLayerId: layerId}
    }));
  }

  _getLayers() {
    return this.props.demo.keplerGl.map?.visState?.layers ?? [];
  }

  render() {
    return (
      <ThemeProvider theme={theme}>
        <GlobalStyle
          // this is to apply the same modal style as kepler.gl core
          // because styled-components doesn't always return a node
          // https://github.com/styled-components/styled-components/issues/617
          ref={node => {
            node ? (this.root = node) : null;
          }}
        >
          <Banner
            show={this.state.showBanner}
            height={BannerHeight}
            bgColor="#2E7CF6"
            onClose={this._hideBanner}
          >
            <Announcement onDisable={this._disableBanner} />
          </Banner>
          <div
            style={{
              transition: 'margin 1s, height 1s',
              position: 'absolute',
              width: '100%',
              height: '100%',
              left: 0,
              top: 0
            }}
          >
            <AutoSizer>
              {({height, width}) => (
                <KeplerGl
                  mapboxApiAccessToken={AUTH_TOKENS.MAPBOX_TOKEN}
                  id="map"
                  /*
                   * Specify path to keplerGl state, because it is not mount at the root
                   */
                  getState={keplerGlGetState}
                  width={width}
                  height={height}
                  cloudProviders={CLOUD_PROVIDERS}
                  localeMessages={messages}
                  onExportToCloudSuccess={onExportFileSuccess}
                  onLoadCloudMapSuccess={onLoadCloudMapSuccess}
                />
              )}
            </AutoSizer>
          </div>
          <button
            style={{position: 'fixed', bottom: '5px', right: '5px'}}
            onClick={this._openDataAggregrationModal}
            disabled={this._getLayers().filter(isLayerH3).length === 0}
          >
            Aggregate data
          </button>
          {this._getLayers().filter(isLayerH3).length > 0 && (
            <section
              style={{
                display: this.state.dataAggregationModal.isOpen ? undefined : 'none',
                position: 'fixed',
                top: 0,
                left: 0,
                backgroundColor: '#ccc',
                zIndex: 1000
              }}
            >
              Select base layer (must be h3):
              <select
                value={this.state.dataAggregationModal.baseLayerId}
                onChange={this._onSelectBaseLayer}
              >
                {this._getLayers()
                  .filter(isLayerH3)
                  .map(layer => (
                    <option key={layer.id} value={layer.id}>
                      {layer.config.label}
                    </option>
                  ))}
              </select>
              <button onClick={this._aggregateData}>Aggregate data</button>
            </section>
          )}
        </GlobalStyle>
      </ThemeProvider>
    );
  }
}

function aggregateData(baseSet, otherSets) {
  const newBaseSetData = {
    fields: baseSet.processed.fields.concat([
      {
        analyzerType: 'FLOAT',
        displayName: 'TotalRisk',
        fieldIdx: baseSet.processed.fields.length,
        format: '',
        id: 'TotalRisk',
        name: 'TotalRisk',
        type: 'real'
      }
    ]),
    rows: baseSet.processed.rows.map(row => row.concat([0.12345]))
  };
  return {
    ...baseSet,
    processed: newBaseSetData
  };
}

function isDatasetH3(dataset) {
  return dataset.processed.fields.some(
    field =>
      (field.name.includes('h3') || field.name.includes('hex')) &&
      h3IsValid(dataset.processed.rows[0][field.fieldIdx])
  );
}

function isLayerH3(layer) {
  return layer instanceof KeplerGlLayers.H3Layer;
}

const mapStateToProps = state => state;
const dispatchToProps = dispatch => ({dispatch});

export default connect(mapStateToProps, dispatchToProps)(App);

// Notes:
// app.props.demo.keplerGl.map.visState.layers[number].config.columns['lat' | 'lng' | ...]
// app.props.demo.keplerGl.map.visState.layers[number].config.label
// - Point: lat, lng
// - Hex: hex_id
// - TODO: Support more layer types in the future
