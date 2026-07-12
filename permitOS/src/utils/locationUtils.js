// ─── Shared Location Utilities ──────────────────────────────────────────────
// Centralises all address/state/lat/lon/county resolution so every code path
// that changes location does it the same way — atomically, and with correct
// address and county every time.

import { STATES_ATTAINMENT } from '../data/permitData';

// ─── State Address Defaults ─────────────────────────────────────────────
// Representative industrial-zoned addresses in each state's largest metro area.
// Auto-filled by applyLocation when no preset-specific address is available.
export const STATE_ADDRESS_DEFAULTS = {
  'Alabama':         { address: '1500 Industrial Park Dr, Birmingham, AL 35211',      county: 'Jefferson County',    lat: '33.5186', lon: '-86.8104' },
  'Alaska':          { address: '2000 E Dowling Rd, Anchorage, AK 99507',             county: 'Anchorage County',    lat: '61.1746', lon: '-149.8700' },
  'Arizona':         { address: '2500 S 40th St, Phoenix, AZ 85034',                 county: 'Maricopa County',     lat: '33.4214', lon: '-112.0035' },
  'Arkansas':        { address: '3200 E Roosevelt Rd, Little Rock, AR 72206',         county: 'Pulaski County',      lat: '34.7220', lon: '-92.2673' },
  'California':      { address: '4701 W Imperial Hwy, Los Angeles, CA 90045',        county: 'Los Angeles County',  lat: '33.9311', lon: '-118.3613' },
  'Colorado':        { address: '4800 E 52nd Ave, Denver, CO 80216',                 county: 'Denver County',       lat: '39.7954', lon: '-104.9302' },
  'Connecticut':     { address: '200 Corporate Dr, Hartford, CT 06120',              county: 'Hartford County',     lat: '41.7691', lon: '-72.6934' },
  'Delaware':        { address: '100 Industrial Blvd, Newark, DE 19711',             county: 'New Castle County',   lat: '39.6837', lon: '-75.7497' },
  'Florida':         { address: '7100 Phillips Hwy, Jacksonville, FL 32216',         county: 'Duval County',        lat: '30.2624', lon: '-81.5994' },
  'Georgia':         { address: '850 Lee St SW, Atlanta, GA 30310',                  county: 'Fulton County',       lat: '33.7286', lon: '-84.4012' },
  'Idaho':           { address: '3700 W Aviation Way, Boise, ID 83705',              county: 'Ada County',          lat: '43.5667', lon: '-116.2470' },
  'Illinois':        { address: '10500 W 153rd St, Chicago, IL 60439',               county: 'Cook County',         lat: '41.5917', lon: '-87.8667' },
  'Indiana':         { address: '2200 S Tibbs Ave, Indianapolis, IN 46241',          county: 'Marion County',       lat: '39.7083', lon: '-86.2517' },
  'Iowa':            { address: '8200 S McKinley Ave, Des Moines, IA 50317',         county: 'Polk County',         lat: '41.5383', lon: '-93.5092' },
  'Kansas':          { address: '4300 N I-135, Wichita, KS 67219',                   county: 'Sedgwick County',     lat: '37.7599', lon: '-97.3285' },
  'Kentucky':        { address: '4100 Produce Rd, Louisville, KY 40218',             county: 'Jefferson County',    lat: '38.1683', lon: '-85.6726' },
  'Louisiana':       { address: '11000 Airline Hwy, Baton Rouge, LA 70816',          county: 'East Baton Rouge',    lat: '30.4475', lon: '-91.0582' },
  'Maine':           { address: '60 Industrial Way, Portland, ME 04103',             county: 'Cumberland County',   lat: '43.7045', lon: '-70.3042' },
  'Maryland':        { address: '7200 Parkway Dr, Hanover, MD 21076',                county: 'Anne Arundel County', lat: '39.1563', lon: '-76.7186' },
  'Massachusetts':   { address: '50 Park Plaza, Boston, MA 02116',                   county: 'Suffolk County',      lat: '42.3491', lon: '-71.0690' },
  'Michigan':        { address: '6875 36th St SE, Grand Rapids, MI 49512',           county: 'Kent County',         lat: '42.8778', lon: '-85.5223' },
  'Minnesota':       { address: '3600 E 28th St, Minneapolis, MN 55407',             county: 'Hennepin County',     lat: '44.9509', lon: '-93.2715' },
  'Mississippi':     { address: '800 Highway 49 S, Jackson, MS 39218',               county: 'Hinds County',        lat: '32.2720', lon: '-90.1687' },
  'Missouri':        { address: '4400 N Bellefontaine Ave, Kansas City, MO 64117',   county: 'Clay County',         lat: '39.1758', lon: '-94.5291' },
  'Montana':         { address: '2900 Bay Dr, Billings, MT 59101',                   county: 'Yellowstone County',  lat: '45.7804', lon: '-108.5246' },
  'Nebraska':        { address: '4700 N 12th St, Lincoln, NE 68521',                 county: 'Lancaster County',    lat: '40.8515', lon: '-96.7054' },
  'Nevada':          { address: '6200 W Sunset Rd, Las Vegas, NV 89118',             county: 'Clark County',        lat: '36.0812', lon: '-115.2415' },
  'New Hampshire':   { address: '1000 Quality Dr, Hooksett, NH 03106',               county: 'Merrimack County',    lat: '43.0725', lon: '-71.4500' },
  'New Jersey':      { address: '700 Industrial Ave, Newark, NJ 07114',              county: 'Essex County',        lat: '40.7041', lon: '-74.1934' },
  'New Mexico':      { address: '3501 University Blvd SE, Albuquerque, NM 87106',    county: 'Bernalillo County',   lat: '35.0464', lon: '-106.6099' },
  'New York':        { address: '1000 Burnet Ave, Syracuse, NY 13203',               county: 'Onondaga County',     lat: '43.0535', lon: '-76.1404' },
  'North Carolina':  { address: '2700 Discovery Dr, Charlotte, NC 28216',            county: 'Mecklenburg County',  lat: '35.2952', lon: '-80.9185' },
  'North Dakota':    { address: '1300 University Dr, Fargo, ND 58102',               county: 'Cass County',         lat: '46.9044', lon: '-96.7906' },
  'Ohio':            { address: '1800 Columbus Ave, Columbus, OH 43216',             county: 'Franklin County',     lat: '39.9588', lon: '-83.0176' },
  'Oklahoma':        { address: '5500 W Reno Ave, Oklahoma City, OK 73127',          county: 'Oklahoma County',     lat: '35.4644', lon: '-97.6285' },
  'Oregon':          { address: '10000 NE Marx St, Portland, OR 97220',              county: 'Multnomah County',    lat: '45.5598', lon: '-122.5563' },
  'Pennsylvania':    { address: '3700 S 26th St, Philadelphia, PA 19145',            county: 'Philadelphia County', lat: '39.9260', lon: '-75.1876' },
  'Rhode Island':    { address: '2000 Plainfield Pike, Cranston, RI 02921',          county: 'Providence County',   lat: '41.7715', lon: '-71.4900' },
  'South Carolina':  { address: '2001 Piedmont Blvd, Columbia, SC 29201',            county: 'Richland County',     lat: '34.0103', lon: '-81.0146' },
  'South Dakota':    { address: '4500 N Cliff Ave, Sioux Falls, SD 57104',           county: 'Minnehaha County',    lat: '43.5689', lon: '-96.7406' },
  'Tennessee':       { address: '1200 Industrial Blvd, Nashville, TN 37201',         county: 'Davidson County',     lat: '36.1627', lon: '-86.7816' },
  'Texas':           { address: '10001 Wallisville Rd, Houston, TX 77029',           county: 'Harris County',       lat: '29.7488', lon: '-95.2843' },
  'Utah':            { address: '3600 W 2100 S, Salt Lake City, UT 84120',           county: 'Salt Lake County',    lat: '40.7244', lon: '-111.9284' },
  'Vermont':         { address: '1000 Ave of the Industrial, Williston, VT 05495',   county: 'Chittenden County',   lat: '44.4528', lon: '-73.1046' },
  'Virginia':        { address: '1500 Boulders Rd, Richmond, VA 23225',              county: 'Chesterfield County', lat: '37.5238', lon: '-77.5125' },
  'Washington':      { address: '8600 S 192nd St, Kent, WA 98031',                   county: 'King County',         lat: '47.4328', lon: '-122.2477' },
  'West Virginia':   { address: '1000 Greenbrier St, Charleston, WV 25311',          county: 'Kanawha County',      lat: '38.3472', lon: '-81.6294' },
  'Wisconsin':       { address: '4500 W Mitchell St, Milwaukee, WI 53214',           county: 'Milwaukee County',    lat: '43.0099', lon: '-87.9662' },
  'Wyoming':         { address: '2000 E Yellowstone Hwy, Casper, WY 82601',          county: 'Natrona County',      lat: '42.8630', lon: '-106.2811' },
};

// ─── Preset-Specific Realistic Addresses ──────────────────────────────────
// Named presets get their own realistic site address — no generic state-level
// fallbacks for named real-world locations during demos.
export const PRESET_SPECIFIC_ADDRESSES = {
  'BigWatt HQ — Nashville, TN': {
    address: '1200 Industrial Blvd, Nashville, TN 37201',
    county: 'Davidson County',
  },
  'Ashburn, VA (Data Center Alley)': {
    address: '21445 Beaumeade Cir, Ashburn, VA 20147',
    county: 'Loudoun County',
  },
  'Phoenix, AZ (Edge)': {
    address: '2500 S 40th St, Phoenix, AZ 85034',
    county: 'Maricopa County',
  },
  'Dallas, TX (Hyperscale)': {
    address: '8700 E McCommas Blvd, Dallas, TX 75241',
    county: 'Dallas County',
  },
  'Silicon Valley, CA': {
    address: '2600 San Tomas Expy, Santa Clara, CA 95051',
    county: 'Santa Clara County',
  },
  'Columbus, OH (AWS Region)': {
    address: '2001 Westbelt Dr, Columbus, OH 43228',
    county: 'Franklin County',
  },
  'Atlanta, GA (Edge)': {
    address: '850 Lee St SW, Atlanta, GA 30310',
    county: 'Fulton County',
  },
  'Northern Virginia (AWS/US East)': {
    address: '16271 Willow Springs Dr, Culpeper, VA 22701',
    county: 'Culpeper County',
  },
};

// ─── Scenario-Card-Specific Addresses ─────────────────────────────────────
// Scenario Explorer cards that include location data get their own addresses.
export const SCENARIO_CARD_ADDRESSES = {
  'CA Nonattainment': {
    address: '4701 W Imperial Hwy, Los Angeles, CA 90045',
    county: 'Los Angeles County',
  },
};

/**
 * applyLocation — single atomic helper that resolves address/county for any
 * location change, regardless of which code path triggered it.
 *
 * Rules:
 *  - If `presetLabel` matches a PRESET_SPECIFIC_ADDRESSES entry, use that.
 *  - Otherwise, if the card title matches a scenario with location data, use that.
 *  - Otherwise, fall back to the STATE_ADDRESS_DEFAULTS for the given state.
 *  - Also sets nonattainment flags based on state.
 *  - Sets `addressFieldsTouched: false` so SiteIntake's guard knows this was
 *    a deliberate programmatic location change, not user-typed data.
 *
 * @param {function} setInputs  React state setter for the shared inputs object
 * @param {object}   options
 * @param {string}   options.state        US state name (required)
 * @param {string}   options.lat          Latitude string (required)
 * @param {string}   options.lon          Longitude string (required)
 * @param {number}   [options.acres]      Site acreage (optional)
 * @param {string}   [options.presetLabel] Named preset label for specific address lookup
 * @param {string}   [options.scenarioTitle] Scenario card title for scenario-specific address
 * @param {object}   [options.extraParams] Additional params to merge into inputs
 */
export function applyLocation(setInputs, { state, lat, lon, acres, presetLabel, scenarioTitle, extraParams } = {}) {
  if (!setInputs || !state || lat == null || lon == null) {
    // If state/lat/lon are missing, just merge extraParams if any
    if (extraParams && setInputs) {
      setInputs(prev => ({ ...prev, ...extraParams }));
    }
    return;
  }

  setInputs(prev => {
    // Resolve address/county — priority: preset > scenario > state default > keep previous
    let address = prev.address;
    let county = prev.county;

    if (presetLabel && PRESET_SPECIFIC_ADDRESSES[presetLabel]) {
      const entry = PRESET_SPECIFIC_ADDRESSES[presetLabel];
      address = entry.address;
      county = entry.county;
    } else if (scenarioTitle && SCENARIO_CARD_ADDRESSES[scenarioTitle]) {
      const entry = SCENARIO_CARD_ADDRESSES[scenarioTitle];
      address = entry.address;
      county = entry.county;
    } else if (STATE_ADDRESS_DEFAULTS[state]) {
      const entry = STATE_ADDRESS_DEFAULTS[state];
      address = entry.address;
      county = entry.county;
    }

    // Nonattainment flags
    const status = STATES_ATTAINMENT[state] || '';
    const isNon = status.includes('Nonattainment');

    const updates = {
      state,
      lat: String(lat),
      lon: String(lon),
      siteAcres: acres ?? prev.siteAcres ?? 45,
      address,
      county,
      nonAttainment: isNon,
      addressFieldsTouched: false,
    };

    if (isNon) {
      updates.nonAttainNOx = true;
      updates.nonAttainPM25 = true;
      updates.nonAttainOzone = true;
    }

    return { ...prev, ...updates, ...extraParams };
  });
}