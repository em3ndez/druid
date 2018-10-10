/*
 * Licensed to Metamarkets Group Inc. (Metamarkets) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. Metamarkets licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

package io.druid.query.aggregation.histogram;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonTypeName;
import org.apache.commons.codec.binary.Base64;
import io.druid.java.util.common.StringUtils;
import io.druid.query.aggregation.AggregateCombiner;
import io.druid.query.aggregation.Aggregator;
import io.druid.query.aggregation.AggregatorFactory;
import io.druid.query.aggregation.AggregatorFactoryNotMergeableException;
import io.druid.query.aggregation.AggregatorUtil;
import io.druid.query.aggregation.BufferAggregator;
import io.druid.query.aggregation.ObjectAggregateCombiner;
import io.druid.segment.ColumnSelectorFactory;
import io.druid.segment.ColumnValueSelector;

import javax.annotation.Nullable;
import java.nio.ByteBuffer;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

@JsonTypeName("fixedBucketsHistogram")
public class FixedBucketsHistogramAggregatorFactory extends AggregatorFactory
{
  private static int DEFAULT_NUM_BUCKETS = 10;

  private final String name;
  private final String fieldName;

  private double lowerLimit;
  private double upperLimit;
  private int numBuckets;

  private FixedBucketsHistogram.OutlierHandlingMode outlierHandlingMode;

  @JsonCreator
  public FixedBucketsHistogramAggregatorFactory(
      @JsonProperty("name") String name,
      @JsonProperty("fieldName") String fieldName,
      @JsonProperty("numBuckets") Integer numBuckets,
      @JsonProperty("lowerLimit") double lowerLimit,
      @JsonProperty("upperLimit") double upperLimit,
      @JsonProperty("outlierHandlingMode") FixedBucketsHistogram.OutlierHandlingMode outlierHandlingMode
  )
  {
    this.name = name;
    this.fieldName = fieldName;
    this.numBuckets = numBuckets == null ? DEFAULT_NUM_BUCKETS : numBuckets;
    this.lowerLimit = lowerLimit;
    this.upperLimit = upperLimit;
    this.outlierHandlingMode = outlierHandlingMode;
  }

  @Override
  public Aggregator factorize(ColumnSelectorFactory metricFactory)
  {
    return new FixedBucketsHistogramAggregator(
        metricFactory.makeColumnValueSelector(fieldName),
        lowerLimit,
        upperLimit,
        numBuckets,
        outlierHandlingMode
    );
  }

  @Override
  public BufferAggregator factorizeBuffered(ColumnSelectorFactory metricFactory)
  {
    return new FixedBucketsHistogramBufferAggregator(
        metricFactory.makeColumnValueSelector(fieldName),
        lowerLimit,
        upperLimit,
        numBuckets,
        outlierHandlingMode
    );
  }

  @Override
  public Comparator getComparator()
  {
    return FixedBucketsHistogramAggregator.COMPARATOR;
  }

  @Nullable
  @Override
  public Object combine(@Nullable Object lhs, @Nullable Object rhs)
  {
    if (lhs == null) {
      if (rhs == null) {
        return null;
      } else {
        return rhs;
      }
    } else {
      return ((FixedBucketsHistogram) lhs).combineHistogram((FixedBucketsHistogram) rhs);
    }
  }

  @Override
  public AggregateCombiner makeAggregateCombiner()
  {
    return new ObjectAggregateCombiner()
    {
      private final FixedBucketsHistogram combined = new FixedBucketsHistogram(
          lowerLimit,
          upperLimit,
          numBuckets,
          outlierHandlingMode
      );

      @Override
      public void reset(ColumnValueSelector selector)
      {
        FixedBucketsHistogram first = (FixedBucketsHistogram) selector.getObject();
        combined.combineHistogram(first);
      }

      @Override
      public void fold(ColumnValueSelector selector)
      {
        FixedBucketsHistogram other = (FixedBucketsHistogram) selector.getObject();
        combined.combineHistogram(other);
      }

      @Override
      public Class<FixedBucketsHistogram> classOfObject()
      {
        return FixedBucketsHistogram.class;
      }

      @Nullable
      @Override
      public FixedBucketsHistogram getObject()
      {
        return combined;
      }
    };
  }

  @Override
  public AggregatorFactory getCombiningFactory()
  {
    return new FixedBucketsHistogramAggregatorFactory(
        name,
        name,
        numBuckets,
        lowerLimit,
        upperLimit,
        outlierHandlingMode
    );
  }

  @Override
  public AggregatorFactory getMergingFactory(AggregatorFactory other) throws AggregatorFactoryNotMergeableException
  {
    return new FixedBucketsHistogramAggregatorFactory(
        name,
        name,
        numBuckets,
        lowerLimit,
        upperLimit,
        outlierHandlingMode
    );
  }

  @Override
  public List<AggregatorFactory> getRequiredColumns()
  {
    return Collections.singletonList(
        new FixedBucketsHistogramAggregatorFactory(
            fieldName,
            fieldName,
            numBuckets,
            lowerLimit,
            upperLimit,
            outlierHandlingMode
        )
    );
  }

  @Override
  public Object deserialize(Object object)
  {
    if (object instanceof byte[]) {
      return FixedBucketsHistogram.fromBytes((byte[]) object);
    } else if (object instanceof ByteBuffer) {
      final FixedBucketsHistogram fbh = FixedBucketsHistogram.fromBytes((ByteBuffer) object);
      return fbh;
    } else if (object instanceof String) {
      byte[] bytes = Base64.decodeBase64(StringUtils.toUtf8((String) object));
      final FixedBucketsHistogram fbh = FixedBucketsHistogram.fromBytes(bytes);
      return fbh;
    } else {
      return object;
    }
  }

  @Nullable
  @Override
  public Object finalizeComputation(@Nullable Object object)
  {
    return ((FixedBucketsHistogram) object).finalizedForm();
  }

  @JsonProperty
  @Override
  public String getName()
  {
    return name;
  }

  @Override
  public List<String> requiredFields()
  {
    return Collections.singletonList(fieldName);
  }

  @Override
  public String getTypeName()
  {
    return "fixedBucketsHistogram";
  }

  @Override
  public int getMaxIntermediateSize()
  {
    return FixedBucketsHistogram.getFullStorageSize(numBuckets);
  }

  @Override
  public byte[] getCacheKey()
  {
    byte[] fieldNameBytes = StringUtils.toUtf8(fieldName);
    return ByteBuffer.allocate(1 + fieldNameBytes.length + Integer.BYTES * 2 + Double.BYTES * 2)
                     .put(AggregatorUtil.FIXED_BUCKET_HIST_CACHE_TYPE_ID)
                     .put(fieldNameBytes)
                     .putInt(outlierHandlingMode.ordinal())
                     .putInt(numBuckets)
                     .putDouble(lowerLimit)
                     .putDouble(upperLimit).array();
  }

  @JsonProperty
  public String getFieldName()
  {
    return fieldName;
  }

  @JsonProperty
  public double getLowerLimit()
  {
    return lowerLimit;
  }

  @JsonProperty
  public double getUpperLimit()
  {
    return upperLimit;
  }

  @JsonProperty
  public int getNumBuckets()
  {
    return numBuckets;
  }

  @JsonProperty
  public FixedBucketsHistogram.OutlierHandlingMode getOutlierHandlingMode()
  {
    return outlierHandlingMode;
  }

  @Override
  public boolean equals(Object o)
  {
    if (this == o) {
      return true;
    }
    if (o == null || getClass() != o.getClass()) {
      return false;
    }
    FixedBucketsHistogramAggregatorFactory that = (FixedBucketsHistogramAggregatorFactory) o;
    return Double.compare(that.getLowerLimit(), getLowerLimit()) == 0 &&
           Double.compare(that.getUpperLimit(), getUpperLimit()) == 0 &&
           getNumBuckets() == that.getNumBuckets() &&
           Objects.equals(getName(), that.getName()) &&
           Objects.equals(getFieldName(), that.getFieldName()) &&
           getOutlierHandlingMode() == that.getOutlierHandlingMode();
  }

  @Override
  public int hashCode()
  {
    return Objects.hash(
        getName(),
        getFieldName(),
        getLowerLimit(),
        getUpperLimit(),
        getNumBuckets(),
        getOutlierHandlingMode()
    );
  }

  @Override
  public String toString()
  {
    return "FixedBucketsHistogramAggregatorFactory{" +
           "name='" + name + '\'' +
           ", fieldName='" + fieldName + '\'' +
           ", lowerLimit=" + lowerLimit +
           ", upperLimit=" + upperLimit +
           ", numBuckets=" + numBuckets +
           ", outlierHandlingMode=" + outlierHandlingMode +
           '}';
  }
}