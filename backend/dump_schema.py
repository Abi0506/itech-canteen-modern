import sqlalchemy as sa
from sqlalchemy.engine import reflection

engine = sa.create_engine('mysql+pymysql://root:Adhianu%402886@localhost:3306/cafe_pos')
insp = reflection.Inspector.from_engine(engine)

for table in sorted(insp.get_table_names()):
    print(f"class {table.title().replace('_', '')}(Base):")
    print(f"    __tablename__ = '{table}'\n")
    cols = insp.get_columns(table)
    for col in cols:
        col_type = str(col['type'])
        nullable = col.get('nullable', True)
        default = col.get('default', None)
        primary_key = col.get('primary_key', 0)
        
        args = []
        if primary_key:
            args.append("primary_key=True")
        if not nullable:
            args.append("nullable=False")
        
        print(f"    {col['name']} = Column({col_type}, {', '.join(args)})")
    
    fks = insp.get_foreign_keys(table)
    for fk in fks:
        print(f"    # FK: {fk['constrained_columns']} -> {fk['referred_table']}.{fk['referred_columns']}")
    print("\n")
