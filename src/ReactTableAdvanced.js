/** @jsx React.DOM */
// TODO handle click events for detail
// TODO handle click events for summary rows
// TODO handle the case when no grouping is needed
// TODO consider making defensive deep copy of the data - since we are modifying it (performance vs. correctness trade off)
// TODO handle sorting - use the same philosophy as the original sorting routines
// TODO formatting
// TODO callback for adding a column
// TODO handle remove a column
// TODO collapse table by default to save space
// TODO lastly, pagination if at all possible ... I don't see how
var SECTOR_SEPARATOR = "#";
var Row = React.createClass({
    render: function () {
        // styling & identation
        var identLevel = !this.props.data.isDetail ? (this.props.data.sectorPath.length - 1) : this.props.data.sectorPath.length;
        var firstCellStyle = {
            "padding-left": identLevel * 25 + "px", "border-right": "1px #ddd solid"
        };
        var cells = [];
        var firstCell;
        var firstColTag = this.props.columnDefs[0].colTag;
        if (this.props.data.isDetail) {
            firstCell = <td style={firstCellStyle} key={this.props.data[firstColTag]}>{this.props.data[firstColTag]}</td>;
        } else {
            firstCell =
                (
                    <td style={firstCellStyle} key={this.props.data[firstColTag]}>
                        <a onClick={this.props.toggleHide.bind(null, this.props.data)} className="btn-link">
                            <strong>{this.props.data[firstColTag]}</strong>
                        </a>
                    </td>
                );
        }
        cells.push(firstCell);
        for (var i = 1; i < this.props.columnDefs.length; i++) {
            var columnDef = this.props.columnDefs[i];
            var style = {"text-align": (columnDef.format == 'number') ? "right" : "left"};
            cells.push(<td style={style} key={columnDef.colTag + "=" + this.props.data[columnDef.colTag]}>{this.props.data[columnDef.colTag]}</td>);
        }
        return (<tr>{cells}</tr>);
    }
});
var TableHeader = React.createClass({
    render: function () {
        var self = this;
        var headers = this.props.columnDefs.map(function (columnDef) {
            return (
                <th key={columnDef.colTag}>
                    <a>{columnDef.text || toProper(columnDef.colTag)}</a>
                </th>
            )
        });
        return (
            <thead>
                <tr>
                    {headers}
                </tr>
            </thead>
        )
    }
});
var Table = React.createClass({
    getInitialState: function () {
        return {
            collapsedSectorPaths: {}
        };
    },
    handleToggleHide: function (summaryRow) {
        var sectorKey = generateSectorKey(summaryRow.sectorPath);
        if (this.state.collapsedSectorPaths[sectorKey] == null)
            this.state.collapsedSectorPaths[sectorKey] = summaryRow.sectorPath;
        else
            delete this.state.collapsedSectorPaths[sectorKey];
        this.setState({
            collapsedSectorPaths: this.state.collapsedSectorPaths
        });
    },
    render: function () {
        var data = this.props.data;
        if (this.props.groupBy)
            data = groupData(this.props.data, this.props.groupBy, this.props.columnDefs);
        data.sort(sorterFactory.call(this, defaultSectorSorter, defaultDetailSorter));
        var unhiddenRows = [];
        for (var i = 0; i < data.length; i++) {
            var row = data[i];
            if (!shouldHide(row, this.state.collapsedSectorPaths))
                unhiddenRows.push(row);
        }
        var rows = unhiddenRows.map(function (row) {
            return <Row data={row} key={generateRowKey(row)} columnDefs={this.props.columnDefs} toggleHide={this.handleToggleHide}></Row>;
        }, this);
        var headers = buildHeaders(this.props);
        return (
            <table className="table table-condensed">
                {headers}
                <tbody>
                    {rows}
                </tbody>
            </table>
        );
    }
});
/* Builder Functions */
function buildHeaders(props) {
    var headerColumns = props.columnDefs.map(function (columnDef) {
        var styles = {
            "text-align": (columnDef.format == 'number') ? "right" : "left"
        };
        return (<th style={styles} key={columnDef.colTag}>{columnDef.text}</th>);
    });
    return headerColumns;
}
/* Utility Functions */
function isSubSectorOf(subSectorCandidate, superSectorCandidate) {
    // lower length in SP means higher up on the chain
    if (subSectorCandidate.length <= superSectorCandidate.length)
        return false;
    for (var i = 0; i < superSectorCandidate.length; i++) {
        if (subSectorCandidate[i] != superSectorCandidate[i])
            return false;
    }
    return true;
}
function shouldHide(data, collapsedSectorPaths) {
    var result = false;
    var hasCollapsedAncestor = areAncestorsCollapsed(data.sectorPath, collapsedSectorPaths);
    var isSummaryRow = !data.isDetail;
    var immediateSectorCollapsed = (collapsedSectorPaths[generateSectorKey(data.sectorPath)] != null);
    if (hasCollapsedAncestor)
        result = true;
    else if (immediateSectorCollapsed && !isSummaryRow)
        result = true;
    return result;
}
// @heavyUtil
function generateRowKey(row) {
    // row key = sectorPath + values of the row
    var key = generateSectorKey(row.sectorPath);
    for (var prop in row) {
        if (row.hasOwnProperty(prop)) {
            key += prop + "=" + row[prop] + ";";
        }
    }
    return key;
}
/**
 * Compares sector path passed to all collapsed sectors to determine if one of the collapsed sectors is the given sector's ancestor
 * @param sectorPath [array] the sectorPath to perform comparison on
 * @param collapsedSectorPaths a map (object) where properties are string representation of the sectorPath considered to be collapsed
 * @returns {boolean}
 */
function areAncestorsCollapsed(sectorPath, collapsedSectorPaths) {
    var result = false;
    // true if sectorPaths is a subsector of the collapsedSectorPaths
    for (var sectorPathKey in collapsedSectorPaths) {
        if (collapsedSectorPaths.hasOwnProperty(sectorPathKey) && isSubSectorOf(sectorPath, collapsedSectorPaths[sectorPathKey]))
            result = true;
    }
    return result;
}
function generateSectorKey(sectorPath) {
    return sectorPath.join(SECTOR_SEPARATOR);
}
function defaultSectorSorter(a, b) {
    return generateSectorKey(a.sectorPath).localeCompare(generateSectorKey(b.sectorPath));
}
function defaultDetailSorter(a, b) {
    return generateRowKey(a).localeCompare(generateRowKey(b));
}
/**
 * Master sorter function that attempts to get the raw data array into the correct order
 * failing to sort the array into the correct order is disastrous for the table as rows are created
 * per the ordering in the main data array
 *
 * this function will attempt to sort the sectors accordingly (by using either a custom sector sorter or just comparing sector path keys)
 * and will delegate detail row sorting to a detail sorter function
 *
 * @param a
 * @param b
 */
function sorterFactory(sectorSorter, detailSorter) {
    return function (a, b) {
        // compare sector
        var result = 0;
        result = sectorSorter.call(this, a, b);

        // same sector therefore, summary > detail
        if (result == 0) {
            if (a.isDetail && !b.isDetail) {
                result = 1;
            } else if (b.isDetail && !a.isDetail) {
                result = -1;
            } else {
                result = 0;
            }
            // both are detail rows ... use detail sorter or just return 0
            if (result == 0) {
                result = detailSorter.call(this, a, b);
            }
        }
        return result;
    }.bind(this);
}