/**
* Copyright 2012-2017, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var d3 = require('d3');
var Drawing = require('../drawing');
var Axes = require('../../plots/cartesian/axes');
var xmlnsNamespaces = require('../../constants/xmlns_namespaces');

module.exports = function draw(gd) {
    var fullLayout = gd._fullLayout,
        imageDataAbove = [],
        imageDataSubplot = [],
        imageDataBelow = [];

    // Sort into top, subplot, and bottom layers
    for(var i = 0; i < fullLayout.images.length; i++) {
        var img = fullLayout.images[i];

        if(img.visible) {
            if(img.layer === 'below' && img.xref !== 'paper' && img.yref !== 'paper') {
                imageDataSubplot.push(img);
            } else if(img.layer === 'above') {
                imageDataAbove.push(img);
            } else {
                imageDataBelow.push(img);
            }
        }
    }


    var anchors = {
        x: {
            left: { sizing: 'xMin', offset: 0 },
            center: { sizing: 'xMid', offset: -1 / 2 },
            right: { sizing: 'xMax', offset: -1 }
        },
        y: {
            top: { sizing: 'YMin', offset: 0 },
            middle: { sizing: 'YMid', offset: -1 / 2 },
            bottom: { sizing: 'YMax', offset: -1 }
        }
    };


    // Images must be converted to dataURL's for exporting.
    function setImage(d) {
        var thisImage = d3.select(this);

        if(this.img && this.img.src === d.source) {
            return;
        }

        thisImage.attr('xmlns', xmlnsNamespaces.svg);

        var imagePromise = new Promise(function(resolve) {

            var img = new Image();
            this.img = img;

            // If not set, a `tainted canvas` error is thrown
            img.setAttribute('crossOrigin', 'anonymous');
            img.onerror = errorHandler;
            img.onload = function() {
                var canvas = document.createElement('canvas');
                canvas.width = this.width;
                canvas.height = this.height;

                var ctx = canvas.getContext('2d');
                ctx.drawImage(this, 0, 0);

                var dataURL = canvas.toDataURL('image/png');

                thisImage.attr('xlink:href', dataURL);
            };


            thisImage.on('error', errorHandler);
            thisImage.on('load', resolve);

            img.src = d.source;

            function errorHandler() {
                thisImage.remove();
                resolve();
            }
        }.bind(this));

        gd._promises.push(imagePromise);
    }

    function applyAttributes(d) {
        var thisImage = d3.select(this);

        // Axes if specified
        var xa = Axes.getFromId(gd, d.xref),
            ya = Axes.getFromId(gd, d.yref);

        var size = fullLayout._size,
            width = xa ? Math.abs(xa.l2p(d.sizex) - xa.l2p(0)) : d.sizex * size.w,
            height = ya ? Math.abs(ya.l2p(d.sizey) - ya.l2p(0)) : d.sizey * size.h;

        // Offsets for anchor positioning
        var xOffset = width * anchors.x[d.xanchor].offset,
            yOffset = height * anchors.y[d.yanchor].offset;

        var sizing = anchors.x[d.xanchor].sizing + anchors.y[d.yanchor].sizing;

        // Final positions
        var xPos = (xa ? xa.r2p(d.x) + xa._offset : d.x * size.w + size.l) + xOffset,
            yPos = (ya ? ya.r2p(d.y) + ya._offset : size.h - d.y * size.h + size.t) + yOffset;


        // Construct the proper aspectRatio attribute
        switch(d.sizing) {
            case 'fill':
                sizing += ' slice';
                break;

            case 'stretch':
                sizing = 'none';
                break;
        }

        thisImage.attr({
            x: xPos,
            y: yPos,
            width: width,
            height: height,
            preserveAspectRatio: sizing,
            opacity: d.opacity
        });


        // Set proper clipping on images
        var xId = xa ? xa._id : '',
            yId = ya ? ya._id : '',
            clipAxes = xId + yId;

        if(clipAxes) {
            thisImage.call(Drawing.setClipUrl, 'clip' + fullLayout._uid + clipAxes);
        }
    }

    var imagesBelow = fullLayout._imageLowerLayer.selectAll('image')
            .data(imageDataBelow),
        imagesSubplot = fullLayout._imageSubplotLayer.selectAll('image')
            .data(imageDataSubplot),
        imagesAbove = fullLayout._imageUpperLayer.selectAll('image')
            .data(imageDataAbove);

    imagesBelow.enter().append('image');
    imagesSubplot.enter().append('image');
    imagesAbove.enter().append('image');

    imagesBelow.exit().remove();
    imagesSubplot.exit().remove();
    imagesAbove.exit().remove();

    imagesBelow.each(function(d) {
        setImage.bind(this)(d);
        applyAttributes.bind(this)(d);
    });
    imagesSubplot.each(function(d) {
        setImage.bind(this)(d);
        applyAttributes.bind(this)(d);
    });
    imagesAbove.each(function(d) {
        setImage.bind(this)(d);
        applyAttributes.bind(this)(d);
    });
};
