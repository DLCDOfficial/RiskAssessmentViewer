import duckdb
import numpy
import pandas as pd
import os 

""" Create and connect to a DuckDB database with spatial and H3 extensions.
  Args:
      db_name (str): Path to the DuckDB database file.
      Returns:
        duckdb.DuckDBPyConnection: Active DuckDB connection.
"""



def create_db(db_name):

  con = duckdb.connect(db_name)

  # Install the extensions (only once per DB)
  con.execute("INSTALL spatial;")
  con.execute("INSTALL h3 FROM community;")

  # Load the extensions
  con.execute("LOAD spatial;")
  con.execute("LOAD h3;")
  return con
places = []
data_dir = './Julia_Results_20260203/'
for item in os.listdir(data_dir):
  full_path = os.path.join(data_dir, item)
  if os.path.isdir(full_path):
      places.append(item)

print(places)


vars = ['population','buildingCount','manufHomesCount','EP_MINRTY','Over90th','SPEI3_Diff','SPEI12_Diff','HousingTenure','NatResrcJobs','flood','libraries','culturalTrust','transGISBridges','criticalFacilities','burn','landslide','liquefaction','flame_height']
indicators = ['population', 'manufHomesCount', 'buildingCount', 'PRED3_PE', 'EP_MINRTY', 'HousingTenure', 'HospitalDistMile', 'NatResrcJobs', 'libraries',
 'culturalTrust', 'transGISBridges', 'criticalFacilities', 'majorRoads', 'imperviousSurface']
harms = ['flood', 'burn', 'landslide', 'liquefaction', 'flame_height', 'Over90th', 'SPEI3_Diff', 'SPEI12_Diff', 'coastalErosion', 'tsunami', 'volcano', ]


harm_asset = []
for harm in harms:
  harm_asset.append({'type': 'harm', 'value': harm})
for ind in indicators:
  harm_asset.append({'type': 'asset', 'value': ind})
# Example usage:
print("NEW")
print(harm_asset)
for place in places:
  city = place.lower()
  print(place)
  input_data = f'{data_dir}{place}/H3_alternative_profiles.csv'
  conn = create_db("risk_assesment.db")

  long_format = []

  df = pd.read_csv(input_data)
  print(len(df))
  for ind, row in df.iterrows():
    for harm in harms:
      if harm in row:
        long_format.append(
        {
        'GRID_ID': row['hexString'],
        'var': harm,
        'region_pct_rank': row[harm],
        'type': 'harm' 
        })
    for ind in indicators:
      if ind in row:
        long_format.append(
        {
        'GRID_ID': row['hexString'],
        'var': ind,
        'region_pct_rank': row[ind],
        'type': 'asset' 
        })

  print(len(long_format))

  df_long = pd.DataFrame(long_format)
  # 3. Register the DataFrame as a virtual table named 'my_table'
  conn.register('data_table',df_long)

  res = conn.execute("SELECT * FROM data_table LIMIT 10;").fetchdf()

  print("success!")

  query = f""" SELECT  
    GRID_ID,  
    var,
    region_pct_rank,  
    percent_rank() OVER (PARTITION BY var ORDER BY region_pct_rank) AS ugb_pct_rank  
  FROM data_table ORDER BY ugb_pct_rank;  """

  parquet_query =f"""
  COPY (
    SELECT  
      GRID_ID,  
      var,
      type,
      region_pct_rank,  
      percent_rank() OVER (
        PARTITION BY var 
        ORDER BY region_pct_rank
      ) AS ugb_pct_rank
    FROM data_table
  )
  TO './data/{city}.parquet'
  (FORMAT PARQUET,
  COMPRESSION SNAPPY);
  """

  parent_query = f"""
  COPY (
  WITH parent_hex AS (
    SELECT
      h3_cell_to_parent(GRID_ID, 8) AS parent_id,
      var,
      type,
      region_pct_rank
    FROM data_table
  ),

  aggregated AS (
    SELECT
      parent_id AS GRID_ID,
      var,
      type,
      AVG(region_pct_rank) AS region_pct_rank
    FROM parent_hex
    GROUP BY parent_id, var, type
  )
  SELECT
    GRID_ID,
    var,
    type,
    region_pct_rank,
    percent_rank() OVER (PARTITION BY var ORDER BY region_pct_rank) AS ugb_pct_rank
  FROM aggregated
  )
  TO './data/{city}_low.parquet'
  (FORMAT PARQUET, 
  COMPRESSION SNAPPY);"""

  conn.execute(parquet_query)
  conn.execute(parent_query)
places_df = pd.DataFrame(places, columns = ['name'])
ha_df = pd.DataFrame(harm_asset)

places_df.to_parquet("places.parquet", index=False)
ha_df.to_parquet("harms_assets.parquet", index=False)

